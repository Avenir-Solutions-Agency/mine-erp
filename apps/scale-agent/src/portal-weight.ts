// The PORTAL AI ERP API spec (docs/reference/portal-ai/erp-api-1.2-hu.pdf) says GET /status carries
// the live weight but does not name the field. These keys are tried in order unless
// PORTAL_WEIGHT_FIELD names it (dot path, e.g. "scale.weight_kg") after the on-site probe.
const CANDIDATES = [
  "live_weight_kg",
  "live_weight",
  "current_weight_kg",
  "current_weight",
  "weight_kg",
  "weight",
  "gross_kg",
  "kg",
];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const at = (o: unknown, path: string) =>
  path
    .split(".")
    .reduce<unknown>((x, k) => (isObject(x) ? x[k] : undefined), o);

/** Breadth-first: a candidate at the top wins over one nested deeper. */
function find(o: unknown): unknown {
  let level: unknown[] = [o];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const objects = level.filter(isObject);
    for (const key of CANDIDATES)
      for (const x of objects) if (key in x) return x[key];
    level = objects.flatMap((x) => Object.values(x));
  }
  return undefined;
}

/** Leaf key paths, so the operator can pick PORTAL_WEIGHT_FIELD from the error message. */
function paths(o: unknown, prefix = ""): string[] {
  if (!isObject(o)) return prefix ? [prefix] : [];
  return Object.entries(o).flatMap(([k, v]) =>
    paths(v, prefix ? `${prefix}.${k}` : k),
  );
}

function toKg(v: unknown): number | null {
  if (isObject(v)) return toKg(v.kg ?? v.value);
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v.replace(/\s/g, "").replace(",", "."))
        : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** The live weight in kg from a GET /status body; throws with the available keys when not found. */
export function portalWeightKg(status: unknown, field?: string): number {
  const kg = toKg(field ? at(status, field) : find(status));
  if (kg != null) return kg;
  throw new Error(
    field
      ? `a(z) "${field}" mező nem súly`
      : `nem találom a súlyt; állítsa be a PORTAL_WEIGHT_FIELD-et. Mezők: ${paths(status).slice(0, 30).join(", ")}`,
  );
}
