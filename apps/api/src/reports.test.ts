import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { Reports } from "./reports.ts";

const ship = (
  n: number,
  shippedAt: string,
  customer: string,
  netKg: number,
  status: "registered" | "cancelled" = "registered",
) => ({
  id: `00000000-0000-7000-8000-00000000000${n}`,
  registryNumber: `SZ-2026-00000${n}`,
  status,
  weighingId: `00000000-0000-7000-8000-10000000000${n}`,
  plate: "AACG971",
  customer,
  product: "Zúzottkő 22/63",
  netKg,
  shippedAt,
  ekaerTcn: null,
});

const shipments = {
  // Newest first, as Shipments.list returns them.
  list: async () => [
    ship(4, "2026-11-30T23:30:00Z", "Késő Kft.", 5_000), // 1 December in Budapest: outside
    ship(3, "2026-11-10T08:00:00Z", "Híd Bt.", 30_000, "cancelled"),
    ship(2, "2026-11-05T08:00:00Z", "Út Kft.", 20_000),
    ship(1, "2026-10-31T23:30:00Z", "Út Kft.", 24_000), // 1 November in Budapest: inside
  ],
};

test("the report keeps Budapest days, oldest first, and counts only registered shipments", async () => {
  const reports = new Reports(shipments as never);

  const r = await reports.shipmentReport("2026-11-01", "2026-11-30");

  expect(r.rows.map((s) => s.registryNumber)).toEqual([
    "SZ-2026-000001",
    "SZ-2026-000002",
    "SZ-2026-000003",
  ]);
  expect(r.total).toEqual({ count: 2, netKg: 44_000 });
});

test("the Excel file has the three sheets and a total row", async () => {
  const reports = new Reports(shipments as never);

  const file = await reports.shipmentWorkbook("2026-11-01", "2026-11-30");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file);

  expect(wb.worksheets.map((w) => w.name)).toEqual([
    "Szállítások",
    "Vevők szerint",
    "Termékek szerint",
  ]);
  expect(wb.getWorksheet("Szállítások")!.rowCount).toBe(4);
  const byCustomer = wb.getWorksheet("Vevők szerint")!;
  const last = byCustomer.getRow(byCustomer.rowCount);
  expect([last.getCell(1).value, last.getCell(3).value]).toEqual([
    "Összesen",
    44_000,
  ]);
});

test("an invalid range is refused", async () => {
  const reports = new Reports(shipments as never);

  const call = reports.shipmentReport("2026-12-01", "2026-11-01");

  await expect(call).rejects.toMatchObject({ status: 400 });
});
