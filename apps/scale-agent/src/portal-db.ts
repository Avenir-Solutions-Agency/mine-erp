// Reads weighings from the PORTAL AI program's own SQLite file (portal.db), read only: the vendor
// allows reading with file-system rights and forbids writing (PORTAL AI database reference §7).
import { DatabaseSync } from "node:sqlite";

/** Same shape as PortalWeighingInput in packages/contracts (kept local: the agent has no deps). */
export interface PortalWeighing {
  portalId: number;
  ticketNumber: string | null;
  direction: "inbound" | "outbound" | null;
  status: "open" | "completed" | "void";
  licensePlate: string | null;
  trailerPlate: string | null;
  customerName: string | null;
  customerTaxNumber: string | null;
  materialName: string | null;
  grossKg: number | null;
  tareKg: number | null;
  netKg: number | null;
  firstWeightKg: number | null;
  firstMeasuredAt: string | null;
  completedAt: string | null;
  driverName: string | null;
  carrierName: string | null;
  ekaerNumber: string | null;
}

export type WeightUnit = "kg" | "t";

type Raw = Record<string, unknown>;

const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** PORTAL stores REAL weights; the ERP keeps integer kg. Out of range means a bad unit setting. */
export function toKg(v: unknown, unit: WeightUnit): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (v == null || v === "" || !Number.isFinite(n)) return null;
  const kg = Math.round(unit === "t" ? n * 1000 : n);
  return Math.abs(kg) <= 200_000 ? kg : null;
}

/**
 * PORTAL writes times as text. With a zone it is used as is; without one it is the scale PC's
 * local time (Budapest), which `new Date` reads as local on that PC.
 */
export function toUtc(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toPortalWeighing(
  r: Raw,
  unit: WeightUnit,
): PortalWeighing | null {
  const status = r.status;
  if (status !== "open" && status !== "completed" && status !== "void")
    return null;
  if (typeof r.id !== "number" && typeof r.id !== "bigint") return null;
  const direction = r.direction;
  return {
    portalId: Number(r.id),
    ticketNumber: text(r.ticket_number, 64),
    direction:
      direction === "inbound" || direction === "outbound" ? direction : null,
    status,
    licensePlate: text(r.license_plate, 32),
    trailerPlate: text(r.trailer_plate, 32),
    customerName: text(r.customer_name, 300),
    customerTaxNumber: text(r.customer_tax_number, 32),
    materialName: text(r.material_name, 200),
    grossKg: toKg(r.gross, unit),
    tareKg: toKg(r.tare, unit),
    netKg: toKg(r.net, unit),
    firstWeightKg: toKg(r.first_weight, unit),
    firstMeasuredAt: toUtc(r.first_measured_at),
    completedAt: toUtc(r.completed_at),
    driverName: text(r.driver_name, 200),
    carrierName: text(r.carrier_name, 300),
    ekaerNumber: text(r.ekaer_number, 32),
  };
}

const QUERY = `
SELECT id, ticket_number, direction, status, license_plate, trailer_plate,
  customer_name, customer_tax_number, material_name, gross, tare, net,
  first_weight, first_measured_at, completed_at, driver_name, carrier_name, ekaer_number
FROM weighings
WHERE status = 'open'
  OR datetime(COALESCE(completed_at, first_measured_at, created_at)) >= datetime('now', ?)
ORDER BY id`;

/** Open weighings plus everything from the last `days` days. */
export function readPortalDb(path: string, days: number, unit: WeightUnit) {
  // Opened per read and closed at once, so PORTAL AI never waits on our handle.
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return (db.prepare(QUERY).all(`-${days} days`) as Raw[])
      .map((r) => toPortalWeighing(r, unit))
      .filter((w): w is PortalWeighing => w !== null);
  } finally {
    db.close();
  }
}

/** Posts rows in batches of 500; returns the server's counts or throws with a Hungarian reason. */
export async function postPortalWeighings(
  api: string,
  token: string,
  rows: PortalWeighing[],
) {
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${api}/scale/portal-weighings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ rows: rows.slice(i, i + 500) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`az ERP API ${res.status} hibát adott`);
    const { data } = (await res.json()) as {
      data: { inserted: number; updated: number };
    };
    inserted += data.inserted;
    updated += data.updated;
  }
  return { inserted, updated };
}
