// How often the bridge sends the live weight. The PORTAL AI is read locally twice a second; the
// ERP only gets a heartbeat every 5 s while the bridge is empty and still, and every 0.5 s from
// a change of at least 20 kg on, for as long as a vehicle is on it and 30 s after the last change.
// A loaded bridge stays fast because the ERP needs 3 s of close readings to call a weight stable.

export interface Pace {
  lastKg: number | null;
  lastSentAt: number;
  fastUntil: number;
}

export const PACING = {
  idleMs: 5000,
  fastMs: 500,
  changeKg: 20,
  holdMs: 30_000,
  /** Same as DEFAULT_STABILITY.minKg in packages/domain: below this the bridge is empty. */
  loadedKg: 1000,
};

export const startPace = (): Pace => ({ lastKg: null, lastSentAt: 0, fastUntil: 0 });

/** Whether to send this reading now, and the state for the next one. */
export function pace(p: Pace, kg: number, now: number, cfg = PACING) {
  const changed = p.lastKg === null || Math.abs(kg - p.lastKg) >= cfg.changeKg;
  const fastUntil = changed ? now + cfg.holdMs : p.fastUntil;
  const fast = now < fastUntil || kg >= cfg.loadedKg;
  const send = now - p.lastSentAt >= (fast ? cfg.fastMs : cfg.idleMs);
  return {
    send,
    fast,
    next: {
      lastKg: changed ? kg : p.lastKg,
      lastSentAt: send ? now : p.lastSentAt,
      fastUntil,
    },
  };
}
