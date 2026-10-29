// A pretend weight indicator: it settles on the load the way a weighbridge does, so the
// API's stability rule can be exercised without hardware. Replaced by a real reader (serial
// or TCP) once the indicator model is known (PRD §08).

/** A truck needs this long to roll on and stop swinging, ms. */
export const SETTLE_MS = 2500;
/** Weighbridge display division, kg. */
export const DIVISION_KG = 20;

export interface Load {
  kg: number;
  /** When the load changed, epoch ms. */
  since: number;
}

/** Indicator value at `now`: ramps and swings while settling, then holds within one division. */
export function indicatorKg(
  load: Load,
  now: number,
  random = Math.random,
): number {
  const t = now - load.since;
  if (load.kg === 0) return t < SETTLE_MS ? Math.round(random() * 400) : 0;
  const settled = t >= SETTLE_MS;
  const raw = settled
    ? load.kg + (random() < 0.2 ? DIVISION_KG : 0)
    : load.kg * Math.min(1, t / SETTLE_MS) + (random() - 0.5) * 600;
  return Math.max(0, Math.round(raw / DIVISION_KG) * DIVISION_KG);
}
