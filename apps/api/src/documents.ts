import { createHash } from "node:crypto";
import {
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
import type { DocumentDto } from "@mine-erp/contracts";
import { type Db, desc, document, eq, eventLog } from "@mine-erp/db";
import { type Actor, AuthGuard, CurrentActor, RateLimit } from "./auth.ts";
import { TEMPORAL } from "./ekaer-reports.ts";
import { ENV, type Env } from "./env.ts";
import { ApiError } from "./http.ts";
import { DB } from "./invoices.repository.ts";
import { sniffType } from "./invoices.service.ts";
import { budapestMonth, Storage } from "./storage.ts";

type DocumentRow = typeof document.$inferSelect;

const toDto = (d: DocumentRow): DocumentDto => ({
  id: d.id,
  status: d.status,
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
    return rows.map(toDto);
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

  @Get("documents/:id/file")
  async file(@Param("id", new ParseUUIDPipe()) id: string) {
    return { data: { url: await this.documents.fileUrl(id) } };
  }
}
