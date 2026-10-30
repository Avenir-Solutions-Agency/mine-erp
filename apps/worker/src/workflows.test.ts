import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import {
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
} from "@temporalio/client";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createDocumentActivities, type StepEvent } from "./activities.ts";
import { DOCUMENT_STEPS } from "./workflows.ts";

// A local Temporal dev server started by the SDK (downloaded once and cached), not a mock.
let env: TestWorkflowEnvironment;
beforeAll(async () => {
  env = await TestWorkflowEnvironment.createLocal();
}, 120_000);
afterAll(async () => {
  await env?.teardown();
});

test("processDocument runs every step once, in the documented order", async () => {
  const events: StepEvent[] = [];
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: "test-documents",
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities: createDocumentActivities((e) => events.push(e), {
      ingest: async () => true,
    }),
  });

  const result = await worker.runUntil(
    env.client.workflow.execute("processDocument", {
      taskQueue: "test-documents",
      workflowId: "document-doc-1",
      args: ["doc-1"],
    }),
  );

  expect(result).toEqual([...DOCUMENT_STEPS]);
  expect(events.map((e) => e.step)).toEqual([...DOCUMENT_STEPS]);
  expect(new Set(events.map((e) => e.documentId))).toEqual(new Set(["doc-1"]));
}, 120_000);

test("an unknown document stops at ingest without retrying", async () => {
  const events: StepEvent[] = [];
  let ingests = 0;
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: "test-documents-missing",
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities: createDocumentActivities((e) => events.push(e), {
      ingest: async () => (ingests++, false),
    }),
  });

  const run = worker.runUntil(
    env.client.workflow.execute("processDocument", {
      taskQueue: "test-documents-missing",
      workflowId: "document-missing",
      args: ["missing"],
    }),
  );

  await expect(run).rejects.toBeInstanceOf(WorkflowFailedError);
  expect(ingests).toBe(1);
  expect(events).toEqual([]);
}, 120_000);

test("a second start for the same document is refused while the first runs", async () => {
  const start = () =>
    env.client.workflow.start("processDocument", {
      taskQueue: "nobody-listens",
      workflowId: "document-doc-2",
      args: ["doc-2"],
    });
  await start();

  const second = start();

  await expect(second).rejects.toBeInstanceOf(
    WorkflowExecutionAlreadyStartedError,
  );
});
