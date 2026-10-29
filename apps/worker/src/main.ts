// Worker process: connects to Temporal and runs the document workflow and its activities.
import { NativeConnection, Worker } from "@temporalio/worker";
import { createDocumentActivities } from "./activities.ts";

const TASK_QUEUE = "documents";

const connection = await NativeConnection.connect({
  address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
});
const worker = await Worker.create({
  connection,
  namespace: "default",
  taskQueue: TASK_QUEUE,
  workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
  activities: createDocumentActivities((e) =>
    console.log(`${e.at} ${e.documentId} ${e.step}`),
  ),
});
console.log(`worker listening on task queue "${TASK_QUEUE}"`);
await worker.run();
