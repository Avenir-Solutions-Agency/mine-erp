// Maps spreadsheet rows (header → cell text) to vehicle and machine inserts. Pure, so it is unit tested.

export type SheetRow = Record<string, string>;

const pick = (row: SheetRow, ...patterns: RegExp[]): string | null => {
  for (const [header, value] of Object.entries(row)) {
    if (value && patterns.some((p) => p.test(header))) return value;
  }
  return null;
};
const int = (v: string | null): number | null => {
  const n = v ? Number.parseInt(v.replace(/\s/g, ""), 10) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Header row of the registration-certificate summary (row 5 of the sheet). */
export function toVehicle(row: SheetRow) {
  const plate = pick(row, /^rendszám/i)
    ?.replace(/\s+/g, "")
    .toUpperCase();
  if (!plate) return null;
  return {
    plate,
    group: pick(row, /^mappacsoport/i),
    category: pick(row, /^kategória/i),
    make: pick(row, /^gyártmány/i),
    model: pick(row, /^típus/i),
    engineNumber: pick(row, /^motorszám/i),
    powerKw: int(pick(row, /^teljesítmény/i)),
    vin: pick(row, /^alvázszám/i),
    v9Code: pick(row, /^v\.9/i),
    euroClass: pick(row, /^euro/i),
    year: int(pick(row, /^évjárat/i)),
    operator: pick(row, /^üzembentartó/i),
    owner: pick(row, /^tulajdonos/i),
    note: pick(row, /^megjegyzés/i),
    source: pick(row, /^forrásirat/i),
    folderUrl: pick(row, /mappája/i),
  };
}

export function toMachine(row: SheetRow) {
  const name = pick(row, /megnevezés|^név|^gép\b|azonosító/i);
  if (!name) return null;
  return {
    name,
    make: pick(row, /gyártmány|gyártó/i),
    model: pick(row, /^típus/i),
    serialNumber: pick(row, /gyári\s*szám|alvázszám|sorozatszám/i),
    year: int(pick(row, /évjárat|gyártási év/i)),
    note: pick(row, /megjegyzés/i),
    attributes: Object.fromEntries(Object.entries(row).filter(([, v]) => v)),
  };
}
