// Activities: the only place in the worker that does I/O (database, storage, EKÁER, Telegram).
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
