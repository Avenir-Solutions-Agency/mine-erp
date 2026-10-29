// Activities: the only place in the worker that does I/O (database, storage, EKÁER, Telegram).
import { ApplicationFailure } from "@temporalio/activity";
import type { EkaerClient } from "@mine-erp/ekaer";
import {
  deleteReport,
  fileReport,
  PermanentEkaerError,
  type ReportStore,
} from "./ekaer.ts";
import type { DocumentStep } from "./workflows.ts";

export interface StepEvent {
  documentId: string;
  step: DocumentStep;
  at: string;
}

/**
 * Stub steps that only report what ran. shortcut: they write to the given sink instead of
 * event_log; each becomes a real activity in T-010 (ingest) … T-014 (ekaer).
 */
export function createDocumentActivities(record: (e: StepEvent) => void) {
  return {
    async runStep(documentId: string, step: DocumentStep): Promise<void> {
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
    deleteEkaerReport: (id: string) =>
      permanent(() => deleteReport(store, client(), id)),
    /** After the last retry: a still-pending report is marked failed so a person checks NAV. */
    async markEkaerUnresolved(id: string, error: string): Promise<void> {
      const r = await store.load(id);
      if (r?.status === "pending") await store.failed(id, error, null);
    },
  };
}

export type EkaerActivities = ReturnType<typeof createEkaerActivities>;
