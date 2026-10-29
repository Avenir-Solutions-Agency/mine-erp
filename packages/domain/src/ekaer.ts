// EKÁER rules that need no I/O (T-014). No relative imports: apps/api and apps/worker load this
// file directly under Node type stripping.

/** The issuing company and its quarry. Source: the company (2026-10-29) and its invoices. */
export const COMPANY = {
  name: "Mészkő-Polgár Kft.",
  taxNumber: "23419791-2-43",
  seat: "1181 Budapest, Havanna utca 44. 7. em. 40. ajtó",
  site: { zipCode: "8154", city: "Polgárdi", street: "Somlyói út 18" },
} as const;

export interface HuAddress {
  zipCode: string;
  city: string;
  street: string;
}

/**
 * "8154 Polgárdi, Somlyói út 18" or "Polgárdi, Somlyói út 18, 8154" → parts. NAV checks the
 * zip and town against its master data, so an address without both is not usable.
 */
export function parseHuAddress(text: string | null): HuAddress | null {
  const t = text?.trim().replace(/\s+/g, " ") ?? "";
  const zipFirst = t.match(/^(\d{4}) ([^,]+),\s*(.+)$/);
  if (zipFirst)
    return {
      zipCode: zipFirst[1]!,
      city: zipFirst[2]!.trim(),
      street: zipFirst[3]!.trim(),
    };
  const zipLast = t.match(/^([^,]+),\s*(.+),\s*(\d{4})$/);
  if (zipLast)
    return {
      zipCode: zipLast[3]!,
      city: zipLast[1]!.trim(),
      street: zipLast[2]!.trim(),
    };
  return null;
}

/** First 8 digits of a Hungarian tax number, as EKÁER wants it. */
export const vatNumber8 = (taxNumber: string | null) =>
  taxNumber?.match(/^(\d{8})-\d-\d{2}$/)?.[1] ?? null;

/** Fillér → whole forints for EKÁER (half up). */
export const fillerToHuf = (filler: bigint) => Number((filler + 50n) / 100n);

export interface ReportInput {
  weighingStatus: "open" | "completed" | "void";
  plate: string;
  customer: {
    name: string;
    taxNumber: string | null;
    address: string | null;
  } | null;
  product: { name: string; vtsz: string | null; ekaerRequired: boolean } | null;
  plannedKg: number;
  valueFiller: bigint;
}

/** Hungarian reasons a report cannot be filed yet; empty means it can. */
export function ekaerProblems(r: ReportInput): string[] {
  const p: string[] = [];
  if (r.weighingStatus === "void")
    p.push("Sztornózott mérlegeléshez nem lehet EKÁER-t bejelenteni.");
  if (!r.product) p.push("Válasszon terméket a mérlegeléshez.");
  else {
    if (!r.product.ekaerRequired)
      p.push(`A(z) ${r.product.name} nincs EKÁER-kötelesnek jelölve.`);
    if (!/^\d{8}$/.test(r.product.vtsz ?? ""))
      p.push("A termék VTSZ-száma 8 számjegy legyen.");
  }
  if (!r.customer) p.push("Válasszon vevőt a mérlegeléshez.");
  else {
    if (!vatNumber8(r.customer.taxNumber))
      p.push("A vevő adószáma hiányzik vagy hibás.");
    if (!parseHuAddress(r.customer.address))
      p.push("A vevő címe „irányítószám település, utca” formában kell.");
  }
  if (
    !Number.isInteger(r.plannedKg) ||
    r.plannedKg <= 0 ||
    r.plannedKg > 999_999_999
  )
    p.push("A tervezett tömeg pozitív egész kilogramm legyen.");
  if (r.valueFiller < 100n || fillerToHuf(r.valueFiller) > 999_999_999)
    p.push("Az érték legalább 1 Ft és legfeljebb 9 számjegy legyen.");
  return p;
}
