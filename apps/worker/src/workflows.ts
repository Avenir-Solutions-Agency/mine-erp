// Temporal workflows. This file is bundled into Temporal's deterministic sandbox: only
// @temporalio/workflow and type-only imports here, no Node APIs, no I/O.
import { proxyActivities } from "@temporalio/workflow";
import type { DocumentActivities } from "./activities.ts";

/** ARCHITECTURE §04: every document goes through these steps, in this order. */
export const DOCUMENT_STEPS = [
  "ingest",
  "extract",
  "normalize",
  "validate",
  "link",
  "register",
  "ekaer",
  "notify",
] as const;
export type DocumentStep = (typeof DOCUMENT_STEPS)[number];

// api-conventions: external calls retry at most 3 times with exponential backoff.
const steps = proxyActivities<DocumentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

/**
 * One document from upload to EKÁER and confirmation. Started with workflowId
 * `document-<documentId>`, so a second start for the same document is refused by Temporal.
 * shortcut: every step is a stub; T-010…T-014 fill them, and the needs_review pause with the
 * resume-from-validate signal comes with the review queue (T-017).
 */
export async function processDocument(
  documentId: string,
): Promise<DocumentStep[]> {
  const done: DocumentStep[] = [];
  for (const step of DOCUMENT_STEPS) {
    await steps.runStep(documentId, step);
    done.push(step);
  }
  return done;
}
