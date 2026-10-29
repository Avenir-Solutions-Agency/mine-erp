// Read-only credential check against NAV's EKÁER *test* system: lists yesterday's and today's
// reports. Creates nothing. The config guard refuses the production host outside production.
import { createEkaerClient, loadEkaerConfig } from "../src/index.ts";

const cfg = loadEkaerConfig();
const host = new URL(cfg.baseUrl).hostname;
if (host !== "import-test.ekaer.nav.gov.hu") {
  console.error(
    `Refusing to run against ${host}: this check is for the test system only.`,
  );
  process.exit(1);
}

const now = new Date();
const r = await createEkaerClient(cfg).queryTradeCards({
  insertFromDate: new Date(now.getTime() - 24 * 3600_000),
  insertToDate: now,
});
console.log(`host: ${host}`);
console.log(
  `result: ${r.funcCode} ${r.reasonCode}${r.msg ? ` (${r.msg})` : ""}`,
);
console.log(`reports in the last 24 h: ${r.result.length}`);
