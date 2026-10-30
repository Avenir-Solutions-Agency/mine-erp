import {
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { ShipmentDto, WeighingDto } from "@mine-erp/contracts";
import {
  and,
  customer,
  type Db,
  desc,
  ekaerReport,
  eq,
  eventLog,
  gte,
  lt,
  inArray,
  isNull,
  nextShipmentRegistrySeq,
  product,
  shipment,
  type Tx,
  weighing,
} from "@mine-erp/db";
import {
  formatRegistryNumber,
  registrationProblems,
} from "@mine-erp/domain/shipment";
import { type Actor, AuthGuard, CurrentActor } from "./auth.ts";
import { ApiError } from "./http.ts";
import { renderDeliveryNoteHtml } from "./delivery-note.ts";
import { ENV, type Env } from "./env.ts";
import { DB } from "./invoices.repository.ts";
import { archiveOnce, budapestMonth, Storage } from "./storage.ts";
import { TicketPdf } from "./ticket.ts";

type WeighingRow = typeof weighing.$inferSelect;

/** Registry numbers restart each calendar year in Hungarian time. */
const budapestYear = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Europe/Budapest",
    }).format(d),
  );

/**
 * The shipment register (PRD F4, T-012/T-018). A completed weighing with customer and product is
 * registered in the same transaction that completes it; a voided weighing cancels its shipment in
 * the transaction that voids it, so the two never disagree.
 */
@Injectable()
export class Shipments {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly pdf: TicketPdf,
    private readonly storage: Storage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * The delivery note (szállítólevél, number = registry number) as issued: rendered and archived
   * once in the weigh-tickets bucket, every later download returns that file. A cancelled
   * shipment gets its own SZTORNÓ copy; the original stays.
   */
  async deliveryNote(id: string): Promise<{ number: string; pdf: Buffer }> {
    const [row] = await this.db
      .select({ s: shipment, w: weighing, c: customer, p: product })
      .from(shipment)
      .innerJoin(weighing, eq(weighing.id, shipment.weighingId))
      .leftJoin(customer, eq(customer.id, shipment.customerId))
      .leftJoin(product, eq(product.id, shipment.productId))
      .where(eq(shipment.id, id));
    if (!row)
      throw new ApiError(404, "not_found", "A szállítás nem található.");
    const { s, w, c, p } = row;
    const cancelled = s.status === "cancelled";
    const pdf = await archiveOnce(
      this.storage,
      this.env.WEIGH_TICKET_BUCKET,
      cancelled ? s.cancelledNotePath : s.deliveryNotePath,
      `delivery-notes/${budapestMonth(s.shippedAt)}/${s.registryNumber}${cancelled ? "-sztorno" : ""}.pdf`,
      async () => {
        const [r] = await this.db
          .select({ tcn: ekaerReport.tcn, status: ekaerReport.status })
          .from(ekaerReport)
          .where(eq(ekaerReport.weighingId, s.weighingId))
          .orderBy(desc(ekaerReport.createdAt))
          .limit(1);
        return this.pdf.fromHtml(
          renderDeliveryNoteHtml({
            number: s.registryNumber,
            cancelled,
            shippedAt: s.shippedAt.toISOString(),
            plate: s.plate,
            trailerPlate: w.trailerPlate,
            // Names as registered; tax number and address from master data.
            customer: {
              name: s.customer,
              taxNumber: c?.taxNumber ?? null,
              address: c?.address ?? null,
            },
            product: { name: s.product, vtsz: p?.vtsz ?? null },
            netKg: s.netKg,
            ticketNumber: w.ticketNumber,
            ekaerTcn:
              r && !["deleted", "failed"].includes(r.status) ? r.tcn : null,
          }),
        );
      },
      (path, sha256) => this.recordNote(id, cancelled, path, sha256),
    );
    return { number: s.registryNumber, pdf };
  }

  private async recordNote(
    id: string,
    cancelled: boolean,
    path: string,
    sha256: string,
  ) {
    await this.db.transaction(async (tx) => {
      const [s] = await tx
        .update(shipment)
        .set(
          cancelled
            ? { cancelledNotePath: path, cancelledNoteSha256: sha256 }
            : { deliveryNotePath: path, deliveryNoteSha256: sha256 },
        )
        .where(
          and(
            eq(shipment.id, id),
            isNull(
              cancelled
                ? shipment.cancelledNotePath
                : shipment.deliveryNotePath,
            ),
          ),
        )
        .returning({ id: shipment.id });
      if (s)
        await tx.insert(eventLog).values({
          actorType: "system",
          entity: "shipment",
          entityId: id,
          action: cancelled
            ? "cancelled_note_archived"
            : "delivery_note_archived",
          payload: { path, sha256 },
        });
    });
  }

  private async existing(tx: Tx | Db, weighingId: string) {
    const [s] = await tx
      .select()
      .from(shipment)
      .where(eq(shipment.weighingId, weighingId));
    return s ?? null;
  }

  /** Registers the weighing if it qualifies; returns the Hungarian problems otherwise. */
  async registerIn(tx: Tx, w: WeighingRow, actor: Actor): Promise<string[]> {
    const problems = registrationProblems({
      weighingStatus: w.status,
      netKg: w.netKg,
      customer: w.customer,
      product: w.material,
      alreadyRegistered: (await this.existing(tx, w.id)) != null,
    });
    if (problems.length) return problems;
    const shippedAt = w.secondAt ?? w.firstAt;
    const year = budapestYear(shippedAt);
    const seq = await nextShipmentRegistrySeq(tx, year);
    const [s] = await tx
      .insert(shipment)
      .values({
        registryYear: year,
        registrySeq: seq,
        registryNumber: formatRegistryNumber(year, seq),
        weighingId: w.id,
        status: "registered",
        plate: w.plate,
        customerId: w.customerId,
        productId: w.productId,
        customer: w.customer!,
        product: w.material!,
        netKg: w.netKg!,
        shippedAt,
        createdBy: actor.id,
      })
      .returning({ id: shipment.id, registryNumber: shipment.registryNumber });
    await tx.insert(eventLog).values({
      actorId: actor.id,
      actorType: "person",
      entity: "shipment",
      entityId: s!.id,
      action: "registered",
      payload: { registryNumber: s!.registryNumber, weighingId: w.id },
    });
    return [];
  }

  /** Cancels the weighing's shipment, keeping its number (the register stays gapless). */
  async cancelIn(tx: Tx, weighingId: string, actor: Actor): Promise<void> {
    const [s] = await tx
      .update(shipment)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shipment.weighingId, weighingId),
          eq(shipment.status, "registered"),
        ),
      )
      .returning({ id: shipment.id });
    if (s)
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "shipment",
        entityId: s.id,
        action: "cancelled",
        payload: { weighingId },
      });
  }

  /** Manual registration once the missing customer or product was added. */
  async register(weighingId: string, actor: Actor): Promise<void> {
    const problems = await this.db.transaction(async (tx) => {
      const [w] = await tx
        .select()
        .from(weighing)
        .where(eq(weighing.id, weighingId));
      if (!w)
        throw new ApiError(404, "not_found", "A mérlegelés nem található.");
      return this.registerIn(tx, w, actor);
    });
    if (problems.length)
      throw new ApiError(422, "not_registrable", problems.join(" "));
  }

  /** Registry number and status per weighing, for the Mérleg list and the ticket. */
  async forWeighings(
    ids: string[],
  ): Promise<Map<string, WeighingDto["shipment"]>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({
        weighingId: shipment.weighingId,
        registryNumber: shipment.registryNumber,
        status: shipment.status,
      })
      .from(shipment)
      .where(inArray(shipment.weighingId, ids));
    return new Map(
      rows.map((r) => [
        r.weighingId,
        { registryNumber: r.registryNumber, status: r.status },
      ]),
    );
  }

  /** Newest first (500, or all in an instant range), with the EKÁER number of a live report. */
  async list(range?: { from: Date; to: Date }): Promise<ShipmentDto[]> {
    const rows = await this.db
      .select()
      .from(shipment)
      .where(
        range
          ? and(
              gte(shipment.shippedAt, range.from),
              lt(shipment.shippedAt, range.to),
            )
          : undefined,
      )
      .orderBy(desc(shipment.shippedAt))
      .limit(range ? 100_000 : 500);
    const reports = rows.length
      ? await this.db
          .select({
            weighingId: ekaerReport.weighingId,
            tcn: ekaerReport.tcn,
            status: ekaerReport.status,
          })
          .from(ekaerReport)
          .where(
            inArray(
              ekaerReport.weighingId,
              rows.map((r) => r.weighingId),
            ),
          )
          .orderBy(desc(ekaerReport.createdAt))
      : [];
    const tcn = new Map<string, string | null>();
    for (const r of reports)
      if (!tcn.has(r.weighingId) && !["deleted", "failed"].includes(r.status))
        tcn.set(r.weighingId, r.tcn);
    return rows.map((s) => ({
      id: s.id,
      registryNumber: s.registryNumber,
      status: s.status,
      weighingId: s.weighingId,
      plate: s.plate,
      customer: s.customer,
      product: s.product,
      netKg: s.netKg,
      shippedAt: s.shippedAt.toISOString(),
      ekaerTcn: tcn.get(s.weighingId) ?? null,
    }));
  }
}

@Controller()
@UseGuards(AuthGuard)
export class ShipmentsController {
  constructor(private readonly shipments: Shipments) {}

  @Get("shipments")
  async list() {
    return { data: await this.shipments.list() };
  }

  @Get("shipments/:id/delivery-note")
  async deliveryNote(@Param("id", new ParseUUIDPipe()) id: string) {
    const { number, pdf } = await this.shipments.deliveryNote(id);
    return new StreamableFile(pdf, {
      type: "application/pdf",
      disposition: `inline; filename="${number}.pdf"`,
    });
  }

  @Post("weighings/:id/register")
  async register(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: Actor,
  ) {
    await this.shipments.register(id, actor);
    return { data: { ok: true as const } };
  }
}
