import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FirstWeighingInput, WeighingDto } from "@mine-erp/contracts";
import {
  firstWeighing,
  formatTicketNumber,
  normalizePlate,
  type Result,
  secondWeighing,
  voidWeighing,
  type Weighing,
  weighingWithSavedTare,
} from "@mine-erp/domain/weighing";
import { customer, product } from "@mine-erp/db";
import { autoEkaerDecision } from "@mine-erp/domain/ekaer";
import type { Actor } from "./auth.ts";
import { ApiError, isUniqueViolation } from "./http.ts";
import { EkaerReports } from "./ekaer-reports.ts";
import { Shipments } from "./shipments.ts";
import { MasterData } from "./master-data.ts";
import { ScaleLive } from "./scale.ts";
import { ENV, type Env } from "./env.ts";
import { Policies } from "./policy.ts";
import { Storage } from "./storage.ts";
import { TicketPdf } from "./ticket.ts";
import {
  type WeighingRow,
  WeighingsRepository,
} from "./weighings.repository.ts";

export function toDto(
  w: WeighingRow,
  ekaer: WeighingDto["ekaer"] = null,
  shipment: WeighingDto["shipment"] = null,
): WeighingDto {
  return {
    id: w.id,
    ticketNumber: w.ticketNumber,
    status: w.status,
    plate: w.plate,
    trailerPlate: w.trailerPlate,
    customer: w.customer,
    material: w.material,
    note: w.note,
    firstKg: w.firstKg,
    firstAt: w.firstAt.toISOString(),
    secondKg: w.secondKg,
    secondAt: w.secondAt?.toISOString() ?? null,
    grossKg: w.grossKg,
    tareKg: w.tareKg,
    netKg: w.netKg,
    savedTare: w.savedTare,
    voidReason: w.voidReason,
    ekaer,
    shipment,
  };
}

/** The domain view of a stored row, so the rules decide every transition. */
export function toDomain(w: WeighingRow): Weighing {
  if (w.status === "open")
    return { status: "open", firstKg: w.firstKg, firstAt: w.firstAt.getTime() };
  const completed = {
    status: "completed" as const,
    firstKg: w.firstKg,
    firstAt: w.firstAt.getTime(),
    secondKg: w.secondKg!,
    secondAt: w.secondAt!.getTime(),
    grossKg: w.grossKg!,
    tareKg: w.tareKg!,
    netKg: w.netKg!,
    savedTare: w.savedTare,
  };
  if (w.status === "completed") return completed;
  return {
    status: "void",
    voidReason: w.voidReason ?? "",
    before:
      w.netKg == null
        ? { status: "open", firstKg: w.firstKg, firstAt: w.firstAt.getTime() }
        : completed,
  };
}

function ok<T>(r: Result<T>): T {
  if (!r.ok) throw new ApiError(422, r.code, r.message);
  return r.value;
}

/** Ticket numbers restart each calendar year in Hungarian time. */
const budapestYear = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Europe/Budapest",
    }).format(d),
  );

@Injectable()
export class WeighingsService {
  constructor(
    private readonly repo: WeighingsRepository,
    private readonly scale: ScaleLive,
    private readonly tickets: TicketPdf,
    private readonly masterData: MasterData,
    private readonly ekaer: EkaerReports,
    private readonly shipments: Shipments,
    private readonly storage: Storage,
    private readonly policies: Policies,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private readonly log = new Logger("WeighTickets");

  /** One weighing with its latest EKÁER report and its shipment. */
  private async dto(row: WeighingRow): Promise<WeighingDto> {
    const [reports, shipments] = await Promise.all([
      this.ekaer.latestFor([row.id]),
      this.shipments.forWeighings([row.id]),
    ]);
    return toDto(
      row,
      reports.get(row.id) ?? null,
      shipments.get(row.id) ?? null,
    );
  }

  async list(): Promise<WeighingDto[]> {
    const rows = await this.repo.list(200);
    const ids = rows.map((r) => r.id);
    const [reports, shipments] = await Promise.all([
      this.ekaer.latestFor(ids),
      this.shipments.forWeighings(ids),
    ]);
    return rows.map((r) =>
      toDto(r, reports.get(r.id) ?? null, shipments.get(r.id) ?? null),
    );
  }

  /** First pass, or a finished one-pass weighing with the vehicle's saved tare. The weight comes from the scale, never the client. */
  async first(input: FirstWeighingInput, actor: Actor): Promise<WeighingDto> {
    const plate = normalizePlate(input.plate);
    if (plate.length < 2)
      throw new ApiError(422, "invalid_plate", "Hibás rendszám.");
    const open = await this.repo.openForPlate(plate);
    if (open)
      throw new ApiError(
        409,
        "already_open",
        `Ennek a járműnek nyitott mérlegelése van (${open.ticketNumber}); azt zárja le második méréssel.`,
      );
    // Picked from master data: the name is copied so the ticket keeps it even if it is renamed later.
    const [c, p] = await Promise.all([
      input.customerId
        ? this.masterData.activeById(customer, input.customerId)
        : null,
      input.productId
        ? this.masterData.activeById(product, input.productId)
        : null,
    ]);
    const kg = this.scale.requireStable();
    const now = new Date();
    const v = await this.repo.vehicleByPlate(plate);
    if (input.useSavedTare && v?.tareKg == null)
      throw new ApiError(
        422,
        "no_saved_tare",
        "Ennek a járműnek nincs mentett tárája.",
      );
    const w = ok(
      input.useSavedTare
        ? weighingWithSavedTare(kg, v!.tareKg!, now.getTime())
        : firstWeighing(kg, now.getTime()),
    );
    const done = w.status === "completed" ? w : null;
    const row = await this.repo
      .create(
        {
          status: w.status as "open" | "completed",
          plate,
          vehicleId: v?.id ?? null,
          trailerPlate: input.trailerPlate
            ? normalizePlate(input.trailerPlate)
            : null,
          customer: c?.name ?? (input.customer || null),
          material: p?.name ?? (input.material || null),
          customerId: c?.id ?? null,
          productId: p?.id ?? null,
          note: input.note || null,
          firstKg: kg,
          firstAt: now,
          secondKg: done?.secondKg ?? null,
          secondAt: done ? now : null,
          grossKg: done?.grossKg ?? null,
          tareKg: done?.tareKg ?? null,
          netKg: done?.netKg ?? null,
          savedTare: done?.savedTare ?? false,
        },
        budapestYear(now),
        (seq) => formatTicketNumber(budapestYear(now), seq),
        actor,
        // A one-pass weighing with saved tare is complete at once: register it in the same transaction.
        (tx, w) =>
          w.status === "completed"
            ? this.shipments.registerIn(tx, w, actor)
            : Promise.resolve(),
      )
      .catch((e: unknown) => {
        // Two first weighings for the same plate at once: the partial unique index stops the second.
        if (isUniqueViolation(e, "weighing_one_open_per_plate"))
          throw new ApiError(
            409,
            "already_open",
            "Ennek a járműnek már van nyitott mérlegelése.",
          );
        throw e;
      });
    if (row.status === "completed" && !(await this.autoEkaer(row, actor)))
      this.archiveSoon(row);
    return await this.dto(row);
  }

  async second(id: string, actor: Actor): Promise<WeighingDto> {
    const row = await this.load(id);
    const kg = this.scale.requireStable();
    const now = new Date();
    const w = ok(secondWeighing(toDomain(row), kg, now.getTime()));
    if (w.status !== "completed") throw new Error("unreachable");
    const saved = await this.repo.update(
      id,
      "open",
      {
        status: "completed",
        secondKg: w.secondKg,
        secondAt: now,
        grossKg: w.grossKg,
        tareKg: w.tareKg,
        netKg: w.netKg,
      },
      "second_weighing",
      actor,
      // Registered in the same transaction; without customer or product it stays unregistered
      // and the Mérleg screen offers "Nyilvántartásba vétel" once they are added.
      (tx, w) => this.shipments.registerIn(tx, w, actor),
    );
    if (!saved)
      throw new ApiError(
        409,
        "changed",
        "A mérlegelést közben lezárták vagy sztornózták.",
      );
    // With an automatic report the ticket is archived on first download, so it carries the EKÁER number.
    if (!(await this.autoEkaer(saved, actor))) this.archiveSoon(saved);
    return await this.dto(saved);
  }

  async void(id: string, reason: string, actor: Actor): Promise<WeighingDto> {
    const row = await this.load(id);
    const w = ok(voidWeighing(toDomain(row), reason));
    if (w.status !== "void") throw new Error("unreachable");
    const saved = await this.repo.update(
      id,
      row.status,
      { status: "void", voidReason: w.voidReason, voidedAt: new Date() },
      "voided",
      actor,
      (tx) => this.shipments.cancelIn(tx, id, actor),
    );
    if (!saved)
      throw new ApiError(
        409,
        "changed",
        "A mérlegelés közben megváltozott, töltse újra.",
      );
    this.archiveSoon(saved);
    return await this.dto(saved);
  }

  /** PDF of a completed or void weighing; an open one has no ticket yet. */
  async ticket(id: string): Promise<{ number: string; pdf: Buffer }> {
    const row = await this.load(id);
    if (row.status === "open")
      throw new ApiError(
        409,
        "not_completed",
        "Nyitott mérlegeléshez még nincs mérlegjegy.",
      );
    return { number: row.ticketNumber, pdf: await this.archive(row) };
  }

  /**
   * The archived PDF of this ticket version (issued, or the SZTORNÓ copy). It is rendered and
   * written once; every later download returns the stored file, so an issued ticket never changes
   * when master data does. The file's SHA-256 is kept as evidence.
   */
  private async archive(row: WeighingRow): Promise<Buffer> {
    const bucket = this.env.WEIGH_TICKET_BUCKET;
    const isVoid = row.status === "void";
    const known = isVoid ? row.voidTicketPath : row.ticketPath;
    if (known) return this.storage.download(bucket, known);
    // YYYY-MM in Hungarian time, so a ticket issued just after midnight lands in the right month.
    const month = (row.secondAt ?? row.firstAt)
      .toLocaleString("sv-SE", { timeZone: "Europe/Budapest" })
      .slice(0, 7);
    const path = `${month}/${row.ticketNumber}${isVoid ? "-sztorno" : ""}.pdf`;
    const pdf = await this.tickets.render(await this.dto(row));
    // Another request may have archived it first; then its file is the issued one.
    const stored = (await this.storage.putOnce(
      bucket,
      path,
      pdf,
      "application/pdf",
    ))
      ? pdf
      : await this.storage.download(bucket, path);
    const sha256 = createHash("sha256").update(stored).digest("hex");
    await this.repo.setTicketFile(row.id, isVoid, path, sha256);
    return stored;
  }

  /**
   * T-020: with the switch on and every piece of data present, the second weighing files the
   * EKÁER report itself with the real net weight. Anything missing leaves it to a person; a
   * failure here never fails the weighing. Returns whether a report was started.
   */
  private async autoEkaer(w: WeighingRow, actor: Actor): Promise<boolean> {
    try {
      if (!(await this.policies.ekaerAuto())) return false;
      const [c, p] = await Promise.all([
        this.masterData.customerById(w.customerId),
        this.masterData.productById(w.productId),
      ]);
      const d = autoEkaerDecision({
        enabled: true,
        netKg: w.netKg ?? 0,
        pricePerTonneFiller: p?.pricePerTonne ?? null,
        report: {
          weighingStatus: w.status,
          plate: w.plate,
          customer: c,
          product: p,
        },
      });
      if (!d.file) {
        this.log.log(
          `${w.ticketNumber}: no automatic EKÁER: ${d.reasons.join(" ")}`,
        );
        return false;
      }
      await this.ekaer.file(
        w.id,
        w.netKg!,
        Number((d.valueFiller + 50n) / 100n),
        actor,
        true,
      );
      return true;
    } catch (e) {
      this.log.warn(
        `${w.ticketNumber}: automatic EKÁER not started: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  /** Right after completion or void; if Gotenberg or Storage is down, the first download archives it. */
  private archiveSoon(row: WeighingRow) {
    void this.archive(row).catch((e: unknown) =>
      this.log.warn(
        `${row.ticketNumber} not archived yet: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  private async load(id: string): Promise<WeighingRow> {
    const row = await this.repo.get(id);
    if (!row)
      throw new ApiError(404, "not_found", "A mérlegelés nem található.");
    return row;
  }
}
