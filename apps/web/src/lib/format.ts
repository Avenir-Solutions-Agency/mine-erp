// hu-HU display formatting. Values are stored as integer fillér and kg (ARCHITECTURE.md §06).
const kgFormat = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const hufFormat = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatKg(kg: number): string {
  return `${kgFormat.format(kg)} kg`;
}

export function formatHuf(filler: bigint): string {
  // shortcut: Number() is exact up to 2^53 fillér (~90 billion Ft), far above any shipment value.
  return hufFormat.format(Number(filler) / 100);
}
