// Shipment summaries for the accountant (T-036). Pure; weights in integer kg. No relative
// imports: apps/api loads this file under Node type stripping.

export interface ReportRow {
  registryNumber: string;
  status: "registered" | "cancelled";
  customer: string;
  product: string;
  netKg: number;
}

export interface Total {
  key: string;
  count: number;
  netKg: number;
}

const add = (map: Map<string, Total>, key: string, kg: number) => {
  const t = map.get(key) ?? { key, count: 0, netKg: 0 };
  t.count += 1;
  t.netKg += kg;
  map.set(key, t);
};
const sorted = (map: Map<string, Total>) =>
  [...map.values()].sort(
    (a, b) => b.netKg - a.netKg || a.key.localeCompare(b.key, "hu"),
  );

/** Totals by customer, by product and by customer × product; cancelled shipments are left out. */
export function summarizeShipments(rows: ReportRow[]) {
  const byCustomer = new Map<string, Total>();
  const byProduct = new Map<string, Total>();
  const byCustomerProduct = new Map<string, Total>();
  let count = 0;
  let netKg = 0;
  for (const r of rows) {
    if (r.status !== "registered") continue;
    add(byCustomer, r.customer, r.netKg);
    add(byProduct, r.product, r.netKg);
    add(byCustomerProduct, `${r.customer} · ${r.product}`, r.netKg);
    count += 1;
    netKg += r.netKg;
  }
  return {
    total: { count, netKg },
    byCustomer: sorted(byCustomer),
    byProduct: sorted(byProduct),
    byCustomerProduct: sorted(byCustomerProduct),
  };
}

/** "YYYY-MM-DD" of an instant in Hungarian time. */
export const budapestDate = (d: Date) =>
  d.toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });

/** Inclusive Budapest-day range check: from ≤ to and at most 366 days. */
export function validRange(from: string, to: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to) || from > to) return false;
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000;
  return Number.isFinite(days) && days <= 366;
}
