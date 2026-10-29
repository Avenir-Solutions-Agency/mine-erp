// Real incoming invoices (T-034): money conversion, storage path and the review warning.
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

/**
 * Every new invoice waits for a person to pick its cost carrier (handwritten notes are ignored,
 * decided 2026-10-29). The warning names the key fields the AI could not read.
 */
export function missingFieldsWarning(input: {
  issueDate: string | null;
  gross: number | null;
}): string | null {
  const missing = [
    input.issueDate == null && "kelte",
    input.gross == null && "bruttó összeg",
  ].filter(Boolean);
  return missing.length ? `Nem olvasható: ${missing.join(", ")}.` : null;
}
