// Worker process: connects to Temporal and runs the document and EKÁER workflows.
import { createDb } from "@mine-erp/db";
import { COMPANY, vatNumber8 } from "@mine-erp/domain/ekaer";
import {
  createEkaerClient,
  type EkaerClient,
  loadEkaerConfig,
  simulatedNav,
} from "@mine-erp/ekaer";
import { NativeConnection, Worker } from "@temporalio/worker";
import {
  createDocumentActivities,
  createEkaerActivities,
  dbDocumentStore,
  type Reader,
} from "./activities.ts";
import { dbReportStore } from "./ekaer.ts";
import { openAiExtractor, storageDownload } from "./extract.ts";

const TASK_QUEUE = "documents";

/**
 * EKAER_SIMULATE=true talks to an in-process NAV stand-in (no network) until a test-system user
 * exists. Otherwise the real client with its own guard: required URL, no production outside
 * production. Built on first use, so a worker without EKÁER settings still runs documents.
 */
function ekaerClient(): () => EkaerClient {
  let client: EkaerClient | undefined;
  return () => {
    if (client) return client;
    if (process.env.EKAER_SIMULATE === "true") {
      const cfg = loadEkaerConfig({
        EKAER_BASE_URL:
          "https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer",
        EKAER_USER: "szimulacio",
        EKAER_PASSWORD: "szimulacio",
        EKAER_SIGNING_KEY: "szimulacio",
        EKAER_TAX_NUMBER: vatNumber8(COMPANY.taxNumber)!,
      });
      console.log("EKÁER: simulated NAV (EKAER_SIMULATE=true)");
      return (client = createEkaerClient(cfg, { fetch: simulatedNav().fetch }));
    }
    return (client = createEkaerClient(loadEkaerConfig()));
  };
}

/** Storage and OpenAI from the same names the API uses; missing ones fail the extract step only. */
function reader(): () => Reader {
  let r: Reader | undefined;
  return () => {
    if (r) return r;
    const env = (name: string) => {
      const v = process.env[name];
      if (!v) throw new Error(`${name} is not set`);
      return v;
    };
    return (r = {
      download: storageDownload(
        env("SUPABASE_URL"),
        env("SUPABASE_SECRET_KEY"),
        process.env.WEIGH_TICKET_BUCKET ?? "weigh-tickets",
      ),
      extract: openAiExtractor(env("OPENAI_API_KEY"), env("OPENAI_MODEL")),
    });
  };
}

const { db } = createDb();
const connection = await NativeConnection.connect({
  address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
});
const worker = await Worker.create({
  connection,
  namespace: "default",
  taskQueue: TASK_QUEUE,
  workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
  activities: {
    ...createDocumentActivities(
      (e) => console.log(`${e.at} ${e.documentId} ${e.step}`),
      dbDocumentStore(db),
      reader(),
    ),
    ...createEkaerActivities(dbReportStore(db), ekaerClient()),
  },
});
console.log(`worker listening on task queue "${TASK_QUEUE}"`);
await worker.run();
