// PORTAL AI bridge: runs on a machine on the quarry LAN, reads the live weight from the PORTAL AI
// ERP API (GET /status, read only: this program never writes to PORTAL AI) and forwards it to the
// ERP API like the simulator does. `--probe` prints /health and /status once and exits.
// Settings come from the shell environment, otherwise it asks; it does not read .env.local, whose
// API_BASE_URL and SCALE_AGENT_TOKEN belong to the local development API, not the test server.
import { setTimeout as sleep } from "node:timers/promises";
import { portalWeightKg } from "./portal-weight.ts";
import { postReading } from "./post.ts";
import { ask, askSecret, loadSaved, save } from "./prompt.ts";

const saved = loadSaved();
const env = (name: string) => process.env[name] || undefined;
const api = (
  env("API_BASE_URL") ??
  (await ask("ERP címe", saved.apiUrl ?? "https://erp.94-16-109-232.sslip.io"))
).replace(/\/+$/, "");
const base = (
  env("PORTAL_BASE_URL") ??
  (await ask(
    "PORTAL AI címe",
    saved.portalUrl ?? "http://192.168.1.50:8000/api/v1",
  ))
).replace(/\/+$/, "");
const key =
  env("PORTAL_API_KEY") ??
  (await askSecret("PORTAL AI API-kulcs (portal_erp_…)"));
const token =
  env("SCALE_AGENT_TOKEN") ??
  (await askSecret("ERP mérleg-token (SCALE_AGENT_TOKEN)"));
const field = env("PORTAL_WEIGHT_FIELD");

async function portal(path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// The spec does not list the /status fields, so show them once for the on-site check.
try {
  console.log("PORTAL AI /health:", JSON.stringify(await portal("/health")));
  console.log(
    "PORTAL AI /status:",
    JSON.stringify(await portal("/status"), null, 2),
  );
} catch (e) {
  console.error(`A PORTAL AI nem érhető el (${base}): ${(e as Error).message}`);
  process.exit(1);
}
save({ apiUrl: api, portalUrl: base });
if (process.argv.includes("--probe")) process.exit(0);

for (;;) {
  let line: string;
  try {
    const kg = portalWeightKg(await portal("/status"), field);
    line = `${String(kg).padStart(7)} kg · ${await postReading(api, token, kg)}`;
  } catch (e) {
    line = `PORTAL AI hiba: ${(e as Error).message}`;
  }
  process.stdout.write(`\r${line.slice(0, 110).padEnd(110)}`);
  await sleep(500);
}
