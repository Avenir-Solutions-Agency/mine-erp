import { createHash } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Client } from "@temporalio/client";
import {
  type DocumentDto,
  PaperExtraction,
  RegisterDocumentInput,
} from "@mine-erp/contracts";
import {
  asc,
  customer,
  type Db,
  desc,
  document,
  eq,
  eventLog,
  extraction,
  inArray,
  product,
  shipment,
  weighing,
} from "@mine-erp/db";
import { type Actor, AuthGuard, CurrentActor, RateLimit } from "./auth.ts";
import { EkaerReports, TEMPORAL } from "./ekaer-reports.ts";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";
import { sniffType } from "./invoices.service.ts";
import { budapestYear, Shipments } from "./shipments.ts";
import { budapestMonth, Storage } from "./storage.ts";

type DocumentRow = typeof document.$inferSelect;

const toDto = (
  d: DocumentRow,
  read: unknown = null,
  registryNumber: string | null = null,
): DocumentDto => ({
  id: d.id,
  status: d.status,
  // Stored by the worker after Zod validation; parsed again so an old prompt's shape cannot leak.
  extraction: PaperExtraction.safeParse(read).data ?? null,
  registryNumber,
  fileName: d.fileName,
  fileMime: d.fileMime,
  createdAt: d.createdAt.toISOString(),
});

/** Postgres unique_violation: two uploads of the same file raced past the SHA check. */
const isUniqueViolation = (e: unknown) =>
  (e as { code?: string } | null)?.code === "23505" ||
  (e as { cause?: { code?: string } } | null)?.cause?.code === "23505";

/**
 * Intake of paper weigh tickets and delivery notes (PRD F1, T-010). The file is the evidence, so it
 * is written once to the weigh-ticket archive under its SHA-256; the processDocument workflow
 * (workflowId `document-<id>`) takes it from there.
 */
@Injectable()
export class Documents {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: Storage,
    @Inject(TEMPORAL) private readonly temporal: Client,
    @Inject(ENV) private readonly env: Env,
    private readonly shipments: Shipments,
    private readonly ekaer: EkaerReports,
  ) {}

  async upload(
    file: { buffer: Buffer; originalname: string },
    actor: Actor,
  ): Promise<DocumentDto> {
    const type = sniffType(file.buffer);
    if (!type)
      throw new ApiError(
        422,
        "unsupported_file",
        "Csak PDF, JPG vagy PNG tölthető fel.",
      );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const duplicate = () =>
      new ApiError(409, "duplicate", "Ez a fájl már fel van töltve.");
    const [known] = await this.db
      .select({ id: document.id })
      .from(document)
      .where(eq(document.fileSha256, sha256));
    if (known) throw duplicate();

    const filePath = `scans/${budapestMonth(new Date())}/${sha256}.${type.ext}`;
    // false = an earlier, unrecorded attempt already stored these exact bytes; keep that copy.
    await this.storage.putOnce(
      this.env.WEIGH_TICKET_BUCKET,
      filePath,
      file.buffer,
      type.mime,
    );
    const row = await this.db
      .transaction(async (tx) => {
        const [d] = await tx
          .insert(document)
          .values({
            status: "received",
            source: "web",
            fileSha256: sha256,
            filePath,
            fileName: file.originalname.slice(0, 200),
            fileMime: type.mime,
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "document",
          entityId: d!.id,
          action: "received",
          payload: { sha256, fileName: d!.fileName, source: "web" },
        });
        return d!;
      })
      .catch((e: unknown) => {
        throw isUniqueViolation(e) ? duplicate() : e;
      });

    try {
      await this.temporal.workflow.start("processDocument", {
        taskQueue: "documents",
        workflowId: `document-${row.id}`,
        args: [row.id],
      });
    } catch {
      throw new ApiError(
        503,
        "worker_unavailable",
        "A fájl rögzítve, de a feldolgozás nem indult el (Temporal nem érhető el).",
      );
    }
    return toDto(row);
  }

  async list(): Promise<DocumentDto[]> {
    const rows = await this.db
      .select()
      .from(document)
      .orderBy(desc(document.createdAt))
      .limit(200);
    const reads = rows.length
      ? await this.db
          .select({
            documentId: extraction.documentId,
            result: extraction.result,
          })
          .from(extraction)
          .where(
            inArray(
              extraction.documentId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(extraction.createdAt))
      : [];
    // Ascending, so the newest prompt version's reading wins.
    const latest = new Map(reads.map((x) => [x.documentId, x.result]));
    const registered = rows.some((r) => r.status === "registered")
      ? await this.db
          .select({
            documentId: weighing.documentId,
            number: shipment.registryNumber,
          })
          .from(weighing)
          .innerJoin(shipment, eq(shipment.weighingId, weighing.id))
          .where(
            inArray(
              weighing.documentId,
              rows.map((r) => r.id),
            ),
          )
      : [];
    const numbers = new Map(registered.map((x) => [x.documentId, x.number]));
    return rows.map((r) =>
      toDto(r, latest.get(r.id), numbers.get(r.id) ?? null),
    );
  }

  /**
   * A reviewed paper ticket becomes a completed paper weighing (P-<printed number>) and its
   * shipment in one transaction. EKÁER is filed afterwards, only when the ticket has no number;
   * if that fails the shipment stays and the report can be filed from Mérleg.
   */
  async register(
    id: string,
    input: RegisterDocumentInput,
    actor: Actor,
  ): Promise<{
    registryNumber: string;
    ekaer: "printed" | "filed" | "none";
    warning: string | null;
  }> {
    const blank = (v: string | null | undefined) => v || null;
    const plate = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");
    const at = new Date(input.weighedAt);
    const net = input.grossKg - input.tareKg;
    const printedTcn = blank(input.ekaerNumber);

    const w = await this.db
      .transaction(async (tx) => {
        const [d] = await tx
          .select({ status: document.status })
          .from(document)
          .where(eq(document.id, id))
          .for("update");
        if (!d) throw new ApiError(404, "not_found", "Nincs ilyen dokumentum.");
        if (d.status === "registered")
          throw new ApiError(
            409,
            "already_registered",
            "Ez a jegy már rögzítve van.",
          );
        if (d.status !== "extracted" && d.status !== "unreadable")
          throw new ApiError(
            409,
            "not_ready",
            "A jegy még feldolgozás alatt van.",
          );
        const [c] = await tx
          .select()
          .from(customer)
          .where(eq(customer.id, input.customerId));
        const [p] = await tx
          .select()
          .from(product)
          .where(eq(product.id, input.productId));
        if (!c || !p)
          throw new ApiError(
            422,
            "unknown_master_data",
            "Válasszon létező vevőt és terméket.",
          );

        const [row] = await tx
          .insert(weighing)
          .values({
            ticketYear: budapestYear(at),
            ticketSeq: Number(
              input.paperTicketNumber.match(/(\d+)\D*$/)?.[1] ?? 0,
            ),
            ticketNumber: `P-${input.paperTicketNumber}`,
            status: "completed",
            source: "paper",
            documentId: id,
            plate: plate(input.plate),
            trailerPlate: input.trailerPlate ? plate(input.trailerPlate) : null,
            customer: c.name,
            material: p.name,
            customerId: c.id,
            productId: p.id,
            firstKg: input.grossKg,
            firstAt: at,
            secondKg: input.tareKg,
            secondAt: at,
            grossKg: input.grossKg,
            tareKg: input.tareKg,
            netKg: net,
            paperEkaerTcn: printedTcn,
            deliveryNoteNumber: blank(input.deliveryNoteNumber),
            loadingAddress: blank(input.loadingAddress),
            unloadingAddress: blank(input.unloadingAddress),
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "weighing",
          entityId: row!.id,
          action: "paper_registered",
          payload: {
            documentId: id,
            ticketNumber: row!.ticketNumber,
            netKg: net,
          },
        });
        const problems = await this.shipments.registerIn(tx, row!, actor);
        if (problems.length)
          throw new ApiError(422, "not_registrable", problems.join(" "));
        await tx
          .update(document)
          .set({ status: "registered", updatedAt: new Date() })
          .where(eq(document.id, id));
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "document",
          entityId: id,
          action: "registered",
          payload: { weighingId: row!.id },
        });
        return row!;
      })
      .catch((e: unknown) => {
        throw isUniqueViolation(e)
          ? new ApiError(
              409,
              "duplicate_ticket",
              "Ez a papír jegy már rögzítve van.",
            )
          : e;
      });

    const [s] = await this.db
      .select({ number: shipment.registryNumber })
      .from(shipment)
      .where(eq(shipment.weighingId, w.id));
    if (printedTcn)
      return { registryNumber: s!.number, ekaer: "printed", warning: null };
    if (!input.ekaerValueHuf)
      return { registryNumber: s!.number, ekaer: "none", warning: null };
    try {
      await this.ekaer.file(w.id, net, input.ekaerValueHuf, actor);
      return { registryNumber: s!.number, ekaer: "filed", warning: null };
    } catch (e) {
      return {
        registryNumber: s!.number,
        ekaer: "none",
        warning: `A szállítás rögzítve, az EKÁER-bejelentés nem indult el: ${
          e instanceof ApiError
            ? (e.getResponse() as { error: { message: string } }).error.message
            : "váratlan hiba."
        } A Mérleg oldalon újra bejelenthető.`,
      };
    }
  }

  async fileUrl(id: string): Promise<string> {
    const [d] = await this.db
      .select({ filePath: document.filePath })
      .from(document)
      .where(eq(document.id, id));
    if (!d) throw new ApiError(404, "not_found", "Nincs ilyen dokumentum.");
    return this.storage.signedUrl(
      d.filePath,
      300,
      this.env.WEIGH_TICKET_BUCKET,
    );
  }
}

const uploads = new RateLimit(30, 60_000);

@Controller()
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documents: Documents) {}

  @Get("documents")
  async list() {
    return { data: await this.documents.list() };
  }

  @Post("documents")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentActor() actor: Actor,
  ) {
    uploads.check(actor.id);
    if (!file) throw new ApiError(400, "no_file", "Válasszon ki egy fájlt.");
    return { data: await this.documents.upload(file, actor) };
  }

  @Post("documents/:id/register")
  async register(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = RegisterDocumentInput.safeParse(body);
    if (!input.success) {
      // Our own refinements speak Hungarian; Zod's built-in messages do not, so name the field.
      const issue = input.error.issues[0];
      throw new ApiError(
        400,
        "invalid_input",
        issue?.code === "custom"
          ? issue.message
          : `Ellenőrizze ezt a mezőt: ${issue?.path.join(".") ?? "?"}.`,
      );
    }
    return { data: await this.documents.register(id, input.data, actor) };
  }

  @Get("documents/:id/file")
  async file(@Param("id", new ParseUUIDPipe()) id: string) {
    return { data: { url: await this.documents.fileUrl(id) } };
  }
}
