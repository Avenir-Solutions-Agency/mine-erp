// Weighbridge rules (PRD §08, decided 2026-10-29: the ERP does the weighing). Pure; weights in integer kg.
// No relative imports: apps/api loads this file directly under Node type stripping.

export interface Reading {
  kg: number;
  /** Epoch milliseconds. */
  at: number;
}

export interface StabilityConfig {
  /** Largest allowed spread inside the window, kg (one or two scale divisions). */
  toleranceKg: number;
  /** How long the weight must stay inside the tolerance, ms. */
  stableMs: number;
  /** Below this the bridge counts as empty, kg. */
  minKg: number;
}

/** Same defaults as common weighbridge software: 3 s still, at least 1000 kg, 20 kg division. */
export const DEFAULT_STABILITY: StabilityConfig = {
  toleranceKg: 20,
  stableMs: 3000,
  minKg: 1000,
};

/**
 * The weight to record, or null while the truck is still moving or the bridge is empty.
 * Stable means every reading of the last `stableMs` lies within `toleranceKg`, and the
 * readings reach back at least that far (a single fresh reading is not stable).
 */
export function stableWeight(
  readings: Reading[],
  now: number,
  cfg: StabilityConfig = DEFAULT_STABILITY,
): number | null {
  const from = now - cfg.stableMs;
  const window = readings.filter((r) => r.at >= from && r.at <= now);
  const covered = readings.some((r) => r.at <= from);
  if (!covered || window.length === 0) return null;
  const kgs = window.map((r) => r.kg);
  if (Math.max(...kgs) - Math.min(...kgs) > cfg.toleranceKg) return null;
  const last = Math.round(kgs[kgs.length - 1]!);
  return last >= cfg.minKg ? last : null;
}

export type WeighingError =
  | "not_open"
  | "same_weight"
  | "tare_not_lower"
  | "reason_required"
  | "already_void"
  | "invalid_weight";

export type Result<T> =
  { ok: true; value: T } | { ok: false; code: WeighingError; message: string };

const fail = <T>(code: WeighingError, message: string): Result<T> => ({
  ok: false,
  code,
  message,
});

export type Weighing =
  | { status: "open"; firstKg: number; firstAt: number }
  | {
      status: "completed";
      firstKg: number;
      firstAt: number;
      secondKg: number;
      secondAt: number;
      grossKg: number;
      tareKg: number;
      netKg: number;
      /** True when the tare came from the vehicle's saved tare, not a second weighing. */
      savedTare: boolean;
    }
  | {
      status: "void";
      voidReason: string;
      before: Exclude<Weighing, { status: "void" }>;
    };

const validKg = (kg: number) => Number.isInteger(kg) && kg > 0;

/** First pass over the bridge; the role (gross or tare) is decided by the second pass. */
export function firstWeighing(kg: number, at: number): Result<Weighing> {
  if (!validKg(kg))
    return fail("invalid_weight", "A tömeg pozitív egész kilogramm legyen.");
  return { ok: true, value: { status: "open", firstKg: kg, firstAt: at } };
}

/**
 * Second pass: the heavier weight is gross, the lighter one tare, so the same rule covers
 * loading (empty in, full out) and delivery (full in, empty out).
 */
export function secondWeighing(
  w: Weighing,
  kg: number,
  at: number,
): Result<Weighing> {
  if (w.status !== "open")
    return fail(
      "not_open",
      "Csak nyitott mérlegelés zárható le második méréssel.",
    );
  if (!validKg(kg))
    return fail("invalid_weight", "A tömeg pozitív egész kilogramm legyen.");
  if (kg === w.firstKg)
    return fail("same_weight", "A két mérés azonos, nincs nettó tömeg.");
  const grossKg = Math.max(kg, w.firstKg);
  const tareKg = Math.min(kg, w.firstKg);
  return {
    ok: true,
    value: {
      status: "completed",
      firstKg: w.firstKg,
      firstAt: w.firstAt,
      secondKg: kg,
      secondAt: at,
      grossKg,
      tareKg,
      netKg: grossKg - tareKg,
      savedTare: false,
    },
  };
}

/** One pass for a vehicle whose tare is on file: the bridge weight is gross. */
export function weighingWithSavedTare(
  kg: number,
  savedTareKg: number,
  at: number,
): Result<Weighing> {
  if (!validKg(kg) || !validKg(savedTareKg))
    return fail("invalid_weight", "A tömeg pozitív egész kilogramm legyen.");
  if (savedTareKg >= kg)
    return fail("tare_not_lower", "A mentett tára nem kisebb a mért tömegnél.");
  return {
    ok: true,
    value: {
      status: "completed",
      firstKg: kg,
      firstAt: at,
      secondKg: savedTareKg,
      secondAt: at,
      grossKg: kg,
      tareKg: savedTareKg,
      netKg: kg - savedTareKg,
      savedTare: true,
    },
  };
}

/** Weighings are never deleted: a cancelled one stays as void with its reason. */
export function voidWeighing(w: Weighing, reason: string): Result<Weighing> {
  if (w.status === "void")
    return fail("already_void", "Ez a mérlegelés már sztornózva van.");
  const r = reason.trim();
  if (!r) return fail("reason_required", "A sztornóhoz indoklás kell.");
  return { ok: true, value: { status: "void", voidReason: r, before: w } };
}

/** Gapless per-year ticket number from the database sequence value: MJ-2026-000001. */
export function formatTicketNumber(year: number, seq: number): string {
  return `MJ-${year}-${String(seq).padStart(6, "0")}`;
}

/** "abc-123" and "ABC 123" are the same plate. */
export const normalizePlate = (plate: string) =>
  plate.toUpperCase().replace(/[^0-9A-ZÁÉÍÓÖŐÚÜŰ]/g, "");
