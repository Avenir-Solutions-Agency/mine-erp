// PORTAL AI bridge: runs on the scale PC (Windows), next to the PORTAL AI program. Two jobs, each
// optional:
//  - live weight: reads the PORTAL AI ERP API (GET /status, read only) twice a second;
//  - weighings: reads PORTAL AI's own database (portal.db, read only) every 5 seconds and sends
//    the new or changed weighings.
// Both go to the ERP API with the scale-agent token. `--probe` prints what it can read and exits.
// Settings come from the environment, otherwise it asks; secrets are never written to disk.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type PortalWeighing,
  postPortalWeighings,
  readPortalDb,
  type WeightUnit,
} from "./portal-db.ts";
import { pace, startPace } from "./pacing.ts";
import { portalWeightKg } from "./portal-weight.ts";
import { postReading } from "./post.ts";
import { ask, askSecret, loadSaved, save } from "./prompt.ts";

const saved = loadSaved();
const env = (name: string) => process.env[name] || undefined;
const DEFAULT_DB = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "HidmerlegPortaprogram", "portal.db")
  : "";

const api = (
  env("API_BASE_URL") ??
  (await ask("ERP címe", saved.apiUrl ?? "https://erp.94-16-109-232.sslip.io"))
).replace(/\/+$/, "");
const token =
  env("SCALE_AGENT_TOKEN") ??
  (await askSecret("ERP mérleg-token (SCALE_AGENT_TOKEN)"));
const dbPath =
  env("PORTAL_DB") ??
  (await ask(
    "PORTAL AI adatbázis (portal.db; üresen hagyva kimarad)",
    saved.dbPath ?? DEFAULT_DB,
  ));
// shortcut: PORTAL's REAL weights are assumed kg; the probe shows a row to confirm on site.
const unit: WeightUnit = env("PORTAL_DB_UNIT") === "t" ? "t" : "kg";
const days = Number(env("PORTAL_DB_DAYS") ?? 30);
const base = (
  env("PORTAL_BASE_URL") ??
  (await ask(
    "PORTAL AI ERP API címe (élő súly)",
    saved.portalUrl ?? "http://localhost:8000/api/v1",
  ))
).replace(/\/+$/, "");
// "off": no live weight and no question at start (autostart without a PORTAL AI API key).
const rawKey =
  env("PORTAL_API_KEY") ??
  (await askSecret(
    "PORTAL AI API-kulcs (portal_erp_…; üresen hagyva nincs élő súly)",
  ));
const key = rawKey === "off" ? "" : rawKey;
const field = env("PORTAL_WEIGHT_FIELD");

const useDb = dbPath !== "";
const useLive = key !== "";
if (!useDb && !useLive) {
  console.error(
    "Sem adatbázis, sem API-kulcs nincs megadva: nincs mit küldeni.",
  );
  process.exit(1);
}
if (useDb && !existsSync(dbPath)) {
  console.error(`Nem található a PORTAL AI adatbázis: ${dbPath}`);
  process.exit(1);
}

async function portal(path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// The vendor does not list every field, so show what we read once for the on-site check.
if (useLive)
  try {
    console.log("PORTAL AI /health:", JSON.stringify(await portal("/health")));
    console.log(
      "PORTAL AI /status:",
      JSON.stringify(await portal("/status"), null, 2),
    );
  } catch (e) {
    console.error(
      `A PORTAL AI API nem érhető el (${base}): ${(e as Error).message}`,
    );
    process.exit(1);
  }
if (useDb)
  try {
    const rows = readPortalDb(dbPath, days, unit);
    console.log(
      `portal.db: ${rows.length} mérés az elmúlt ${days} napból (a nyitottakkal). Legutóbbi:`,
      JSON.stringify(rows.at(-1) ?? null, null, 2),
    );
  } catch (e) {
    console.error(
      `A portal.db nem olvasható (${dbPath}): ${(e as Error).message}`,
    );
    process.exit(1);
  }
save({ apiUrl: api, portalUrl: base, dbPath });
if (process.argv.includes("--probe")) process.exit(0);

let liveLine = useLive ? "élő súly: indul" : "élő súly: kikapcsolva";
let dbLine = useDb ? "mérések: indul" : "mérések: kikapcsolva";
// In a window the status line is redrawn in place; as a Windows task the output goes to a log
// file, so one dated line a minute keeps it small.
let loggedAt = 0;
const show = () => {
  const line = `${liveLine} · ${dbLine}`;
  if (process.stdout.isTTY)
    process.stdout.write(`\r${line.slice(0, 118).padEnd(118)}`);
  else if (Date.now() - loggedAt >= 60_000) {
    loggedAt = Date.now();
    process.stdout.write(`${new Date().toLocaleString("hu-HU")} ${line}\n`);
  }
};

async function liveLoop() {
  let p = startPace();
  for (;;) {
    try {
      const kg = portalWeightKg(await portal("/status"), field);
      const r = pace(p, kg, Date.now());
      p = r.next;
      if (r.send)
        liveLine = `${String(kg).padStart(7)} kg · ${r.fast ? "0,5 mp" : "5 mp"} · ${await postReading(api, token, kg)}`;
    } catch (e) {
      liveLine = `PORTAL AI hiba: ${(e as Error).message}`;
    }
    show();
    await sleep(500);
  }
}

async function dbLoop() {
  // What the ERP already has, so only new or changed rows are sent; empty after a restart.
  const sent = new Map<number, string>();
  for (;;) {
    try {
      const changed: PortalWeighing[] = [];
      for (const row of readPortalDb(dbPath, days, unit)) {
        const json = JSON.stringify(row);
        if (sent.get(row.portalId) !== json) changed.push(row);
      }
      if (changed.length) {
        const r = await postPortalWeighings(api, token, changed);
        for (const row of changed) sent.set(row.portalId, JSON.stringify(row));
        dbLine = `mérések: ${new Date().toLocaleTimeString("hu-HU")} · ${r.inserted} új, ${r.updated} módosult`;
      }
    } catch (e) {
      dbLine = `mérések hiba: ${(e as Error).message}`;
    }
    show();
    await sleep(5000);
  }
}

await Promise.all([useLive ? liveLoop() : null, useDb ? dbLoop() : null]);
