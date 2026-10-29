// Real incoming invoices (T-034): money conversion, storage path and the auto-assign rule.
// No relative imports: apps/api loads this file directly under Node type stripping.

/** Forint amount as read from the document → integer fillér. */
export function toFiller(huf: number | null): bigint | null {
  return huf == null || !Number.isFinite(huf)
    ? null
    : BigInt(Math.round(huf * 100));
}

/** Integer fillér → "12345" or "12345.50" for the wire; never a float. */
export function fillerToString(filler: bigint | null): string | null {
  if (filler == null) return null;
  const sign = filler < 0n ? "-" : "";
  const abs = filler < 0n ? -filler : filler;
  const frac = abs % 100n;
  return `${sign}${abs / 100n}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`;
}

/** Files go to YYYY-MM by issue date, so storage stays sorted; unknown dates wait in "datum-nelkul". */
export function invoiceStoragePath(
  issueDate: string | null,
  sha256: string,
  ext: string,
): string {
  const month =
    issueDate?.match(/^(\d{4}-\d{2})-\d{2}$/)?.[1] ?? "datum-nelkul";
  return `${month}/${sha256}.${ext}`;
}

/** Uppercase, letters and digits only, so "uzt 243" and "UZT-243" compare equal. */
export const normalizeCarrier = (s: string) =>
  s.toUpperCase().replace(/[^0-9A-ZÁÉÍÓÖŐÚÜŰ]/g, "");

export interface AssignInput {
  handwriting: string | null;
  issueDate: string | null;
  gross: number | null;
  /** Plates and machine names. */
  carriers: string[];
}

export interface AssignResult {
  status: "needs_review" | "assigned";
  costCarrier: string | null;
  warning: string | null;
}

/**
 * Assign only when exactly one carrier's normalised name occurs in the normalised handwriting; anything else
 * is a human's call (fuzzy matches are suggestions only, ARCHITECTURE §06).
 */
export function assignByHandwriting(input: AssignInput): AssignResult {
  const missing = [
    input.issueDate == null && "kelte",
    input.gross == null && "bruttó összeg",
  ].filter(Boolean);
  const warning = missing.length
    ? `Nem olvasható: ${missing.join(", ")}.`
    : null;
  const note = input.handwriting ? normalizeCarrier(input.handwriting) : "";
  const hits = note
    ? input.carriers.filter((c) => {
        const n = normalizeCarrier(c);
        return n.length >= 3 && note.includes(n);
      })
    : [];
  if (hits.length === 1 && !warning)
    return { status: "assigned", costCarrier: hits[0]!, warning: null };
  return {
    status: "needs_review",
    costCarrier: null,
    warning:
      warning ??
      (hits.length > 1
        ? `Több költségviselő illik a jelölésre: ${hits.join(", ")}.`
        : null),
  };
}
