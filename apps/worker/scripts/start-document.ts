// Manual check: starts processDocument for a document id and prints the finished steps.
// Usage: pnpm --filter @mine-erp/worker start-document <documentId>
import { Client, Connection } from "@temporalio/client";
import { randomUUID } from "node:crypto";

const documentId = process.argv[2] ?? randomUUID();
const connection = await Connection.connect({
  address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
});
const client = new Client({ connection });
const steps = await client.workflow.execute("processDocument", {
  taskQueue: "documents",
  workflowId: `document-${documentId}`,
  args: [documentId],
});
console.log(`document ${documentId}: ${steps.join(" → ")}`);
await connection.close();
