import { expect, test } from "vitest";
import {
  budapestDate,
  type ReportRow,
  summarizeShipments,
  validRange,
} from "./report";

const row = (
  customer: string,
  product: string,
  netKg: number,
  status: ReportRow["status"] = "registered",
): ReportRow => ({
  registryNumber: "SZ",
  status,
  customer,
  product,
  netKg,
});

test("summarizeShipments totals by customer, product and both, without cancelled ones", () => {
  const rows = [
    row("Út Kft.", "22/63", 24_000),
    row("Út Kft.", "22/63", 20_000),
    row("Út Kft.", "0/4", 10_000),
    row("Híd Bt.", "22/63", 30_000),
    row("Híd Bt.", "22/63", 99_000, "cancelled"),
  ];

  const s = summarizeShipments(rows);

  expect(s.total).toEqual({ count: 4, netKg: 84_000 });
  expect(s.byCustomer).toEqual([
    { key: "Út Kft.", count: 3, netKg: 54_000 },
    { key: "Híd Bt.", count: 1, netKg: 30_000 },
  ]);
  expect(s.byProduct.map((t) => [t.key, t.netKg])).toEqual([
    ["22/63", 74_000],
    ["0/4", 10_000],
  ]);
  expect(s.byCustomerProduct).toHaveLength(3);
});

test("budapestDate uses Hungarian time, so late evening UTC is the next day", () => {
  const d = budapestDate(new Date("2026-10-31T23:30:00Z"));

  expect(d).toBe("2026-11-01");
});

test("validRange accepts up to a year, in order", () => {
  const cases = [
    validRange("2026-10-01", "2026-10-31"),
    validRange("2026-10-31", "2026-10-01"),
    validRange("2025-01-01", "2026-10-01"),
    validRange("2026-10-1", "2026-10-31"),
  ];

  expect(cases).toEqual([true, false, false, false]);
});
