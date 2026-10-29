// Shipment register rules (PRD F4, T-012). No relative imports: apps/api loads this file under
// Node type stripping.

/** Gapless per-year registry number from the counter value: SZ-2026-000123. */
export function formatRegistryNumber(year: number, seq: number): string {
  return `SZ-${year}-${String(seq).padStart(6, "0")}`;
}

export interface RegisterInput {
  weighingStatus: "open" | "completed" | "void";
  netKg: number | null;
  customer: string | null;
  product: string | null;
  alreadyRegistered: boolean;
}

/** Hungarian reasons a weighing cannot become a shipment yet; empty means it can. */
export function registrationProblems(r: RegisterInput): string[] {
  const p: string[] = [];
  if (r.alreadyRegistered) p.push("Ez a mérlegelés már nyilvántartásban van.");
  if (r.weighingStatus !== "completed")
    p.push("Csak lezárt mérlegelés vehető nyilvántartásba.");
  if (!r.netKg || r.netKg <= 0) p.push("Nincs nettó tömeg.");
  if (!r.customer) p.push("Válasszon vevőt a mérlegeléshez.");
  if (!r.product) p.push("Válasszon terméket a mérlegeléshez.");
  return p;
}
