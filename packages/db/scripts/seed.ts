// Loads vehicles and machines from the two workbooks in seed-data/ (gitignored: VINs and owners stay out of git).
// Idempotent: upserts on plate and machine name.
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { createDb, machine, vehicle } from "../src/index.ts";
import { type SheetRow, toMachine, toVehicle } from "../src/seed-rows.ts";

const dir = new URL("../seed-data/", import.meta.url);

/** Rows of the first sheet; the header is the first row with at least three distinct cells (merged titles repeat one). */
async function readRows(file: string): Promise<SheetRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(new URL(file, dir).pathname);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`${file}: no worksheet`);
  const cells = (r: number) =>
    (ws.getRow(r).values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === "object" && "richText" in v)
        return (v.richText as { text: string }[])
          .map((t) => t.text)
          .join("")
          .trim();
      if (v && typeof v === "object" && "text" in v)
        return String(v.text).trim();
      if (v && typeof v === "object" && "result" in v)
        return String(v.result ?? "");
      return v == null ? "" : String(v).trim();
    });
  let headerRow = 1;
  while (
    headerRow <= ws.rowCount &&
    new Set(cells(headerRow).filter(Boolean)).size < 3
  )
    headerRow++;
  const headers = cells(headerRow);
  const rows: SheetRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const values = cells(r);
    rows.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
  }
  return rows;
}

/** Last row wins for a repeated key, so one upsert never touches the same row twice; dropped rows are reported. */
function byKey<T>(rows: T[], key: (r: T) => string, label: string): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    if (map.has(key(r)))
      console.warn(
        `${label} ${key(r)}: repeated in the sheet, the last row is kept`,
      );
    map.set(key(r), r);
  }
  return [...map.values()];
}

/** SET col = excluded.col for every column, i.e. the sheet overwrites the database. */
const overwrite = (table: typeof vehicle | typeof machine, keys: string[]) =>
  Object.fromEntries(
    keys.map((k) => [
      k,
      sql.raw(
        `excluded."${(table as unknown as Record<string, { name: string }>)[k]!.name}"`,
      ),
    ]),
  );

const { db, close } = createDb();
try {
  const vehicles = byKey(
    (await readRows("vehicles.xlsx")).map(toVehicle).filter((v) => v !== null),
    (v) => v.plate,
    "vehicle",
  );
  const machines = byKey(
    (await readRows("machines.xlsm")).map(toMachine).filter((m) => m !== null),
    (m) => m.name,
    "machine",
  );
  await db.transaction(async (tx) => {
    if (vehicles.length)
      await tx
        .insert(vehicle)
        .values(vehicles)
        .onConflictDoUpdate({
          target: vehicle.plate,
          set: overwrite(vehicle, Object.keys(vehicles[0]!)),
        });
    if (machines.length)
      await tx
        .insert(machine)
        .values(machines)
        .onConflictDoUpdate({
          target: machine.name,
          set: overwrite(machine, Object.keys(machines[0]!)),
        });
  });
  console.log(
    `seeded ${vehicles.length} vehicles, ${machines.length} machines`,
  );
} finally {
  await close();
}
