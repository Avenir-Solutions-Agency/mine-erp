// PORTAL AI bridge: runs on a machine on the quarry LAN, reads the live weight from the PORTAL AI
// ERP API (GET /status, read only: this program never writes to PORTAL AI) and forwards it to the
// ERP API like the simulator does. `--probe` prints /health and /status once and exits.
import { setTimeout as sleep } from "node:timers/promises";
import { portalWeightKg } from "./portal-weight.ts";
import { postReading } from "./post.ts";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set (see .env.example).`);
    process.exit(1);
  }
  return v;
}

const api = process.env.API_BASE_URL ?? "http://localhost:4000";
const token = need("SCALE_AGENT_TOKEN");
const base = need("PORTAL_BASE_URL").replace(/\/+$/, "");
const key = need("PORTAL_API_KEY");
const field = process.env.PORTAL_WEIGHT_FIELD || undefined;

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
