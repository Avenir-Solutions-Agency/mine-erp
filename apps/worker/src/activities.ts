// Activities: the only place in the worker that does I/O (database, storage, EKÁER, Telegram).
import { ApplicationFailure } from "@temporalio/activity";
import { and, type Db, document, eq, eventLog, extraction } from "@mine-erp/db";
import type { EkaerClient } from "@mine-erp/ekaer";
import {
  deleteReport,
  fileReport,
  finalizeReport,
  modifyReport,
  PermanentEkaerError,
  type ReportStore,
} from "./ekaer.ts";
import {
  type Extract,
  type ExtractionResult,
  PROMPT_VERSION,
} from "./extract.ts";
import type { DocumentStep } from "./workflows.ts";

export interface StepEvent {
  documentId: string;
  step: DocumentStep;
  at: string;
}

/** The document rows the steps change; every change writes its event in the same transaction. */
export interface DocumentStore {
  /** received → ingested; false when there is no such document. A second call changes nothing. */
  ingest(documentId: string): Promise<boolean>;
  /** The stored file to read, or null when this prompt version already read it. */
  toExtract(
    documentId: string,
    promptVersion: string,
  ): Promise<{ path: string; name: string; mime: string } | null>;
  /** Saves what was read: extracted, or unreadable when the model returned nothing. */
  extracted(documentId: string, x: ExtractionResult): Promise<void>;
}

/** What the extract step needs from outside; built on first use so a worker without keys still ingests. */
export interface Reader {
  download(path: string): Promise<Buffer>;
  extract: Extract;
}

export function dbDocumentStore(db: Db): DocumentStore {
  return {
    ingest: (id) =>
      db.transaction(async (tx) => {
        const [d] = await tx
          .select({ status: document.status })
          .from(document)
          .where(eq(document.id, id))
          .for("update");
        if (!d) return false;
        if (d.status !== "received") return true;
        await tx
          .update(document)
          .set({ status: "ingested", updatedAt: new Date() })
          .where(eq(document.id, id));
        await tx.insert(eventLog).values({
          actorType: "system",
          entity: "document",
          entityId: id,
          action: "ingested",
          payload: null,
        });
        return true;
      }),
    async toExtract(id, promptVersion) {
      const [d] = await db
        .select({
          path: document.filePath,
          name: document.fileName,
          mime: document.fileMime,
          done: extraction.id,
        })
        .from(document)
        .leftJoin(
          extraction,
          and(
            eq(extraction.documentId, document.id),
            eq(extraction.promptVersion, promptVersion),
          ),
        )
        .where(eq(document.id, id));
      return d && !d.done ? { path: d.path, name: d.name, mime: d.mime } : null;
    },
    extracted: (id, x) =>
      db.transaction(async (tx) => {
        const status = x.result ? "extracted" : "unreadable";
        await tx
          .insert(extraction)
          .values({
            documentId: id,
            model: x.model,
            promptVersion: x.promptVersion,
            result: x.result,
          })
          .onConflictDoNothing();
        await tx
          .update(document)
          .set({ status, updatedAt: new Date() })
          .where(eq(document.id, id));
        await tx.insert(eventLog).values({
          actorType: "agent",
          entity: "document",
          entityId: id,
          action: status,
          payload: { model: x.model, promptVersion: x.promptVersion },
        });
      }),
  };
}

/**
 * Document steps. ingest (T-010) checks the stored document and marks it ingested; extract (T-011)
 * reads the photo once per prompt version. shortcut: normalize … ekaer only report what ran until
 * T-012 … T-014 fill them.
 */
export function createDocumentActivities(
  record: (e: StepEvent) => void,
  store: DocumentStore,
  reader: () => Reader,
) {
  return {
    async runStep(documentId: string, step: DocumentStep): Promise<void> {
      if (step === "ingest" && !(await store.ingest(documentId)))
        throw ApplicationFailure.nonRetryable(
          `document ${documentId} not found`,
          "DocumentNotFound",
        );
      if (step === "extract") {
        const file = await store.toExtract(documentId, PROMPT_VERSION);
        if (file) {
          const r = reader();
          const x = await r.extract(
            await r.download(file.path),
            file.name,
            file.mime,
          );
          await store.extracted(documentId, x);
        }
      }
      record({ documentId, step, at: new Date().toISOString() });
    },
  };
}

export type DocumentActivities = ReturnType<typeof createDocumentActivities>;

/** EKÁER activities; a PermanentEkaerError becomes non-retryable so Temporal stops at once. */
export function createEkaerActivities(
  store: ReportStore,
  client: () => EkaerClient,
) {
  const permanent = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch (e) {
      if (e instanceof PermanentEkaerError)
        throw ApplicationFailure.nonRetryable(e.message, "PermanentEkaerError");
      throw e;
    }
  };
  return {
    fileEkaerReport: (id: string) =>
      permanent(() => fileReport(store, client(), id)),
    modifyEkaerReport: (id: string) =>
      permanent(() => modifyReport(store, client(), id)),
    finalizeEkaerReport: (id: string) =>
      permanent(() => finalizeReport(store, client(), id)),
    deleteEkaerReport: (id: string) =>
      permanent(() => deleteReport(store, client(), id)),
    /** After the last retry: a still-pending report is marked failed so a person checks NAV. */
    async markEkaerUnresolved(id: string, error: string): Promise<void> {
      const r = await store.load(id);
      if (r?.status === "pending") await store.failed(id, error, null);
      // A modify or finalize that never got an answer: back to active so a person can retry.
      if (r?.status === "modifying" || r?.status === "finalizing")
        await store.changeRefused(id, error, null);
    },
  };
}

export type EkaerActivities = ReturnType<typeof createEkaerActivities>;
