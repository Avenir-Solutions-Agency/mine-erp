import { describe, expect, it } from "vitest";
import {
  approveInvoice,
  assignCarrier,
  carrierTotals,
  filterLineRows,
  invoiceKpis,
  seedInvoicePortal,
  unassignInvoice,
} from "./invoices";

const all = { query: "", carrier: "", category: "" };

describe("invoice portal", () => {
  it("starts like the original page: auto invoices assigned to the top candidate", () => {
    const p = seedInvoicePortal();

    expect(invoiceKpis(p)).toEqual({
      count: 6,
      gross: 156915,
      auto: 4,
      pending: 2,
    });
    expect(p.invoices.find((i) => i.id === "i2")?.assigned).toBe("c3");
    expect(p.invoices.find((i) => i.id === "i1")?.assigned).toBeNull();
  });

  it("settles an invoice when a person picks a carrier", () => {
    const p = assignCarrier(seedInvoicePortal(), "i1", "c2");

    expect(p.invoices[0]).toMatchObject({ assigned: "c2", status: "auto" });
    expect(invoiceKpis(p).pending).toBe(1);
  });

  it("ignores an unknown carrier and approval without an assignment", () => {
    const p = seedInvoicePortal();

    expect(assignCarrier(p, "i1", "nope")).toBe(p);
    expect(approveInvoice(p, "i1")).toBe(p);
  });

  it("moves an unassigned invoice's lines to the unassigned total", () => {
    const p = unassignInvoice(seedInvoicePortal(), "i2");
    const totals = carrierTotals(p);

    expect(totals.find((t) => t.carrier?.id === "c3")?.lines).toBe(0);
    expect(totals.at(-1)).toMatchObject({
      carrier: null,
      lines: 10,
      gross: 96756,
    });
  });

  it("filters lines by text, carrier and category", () => {
    const p = seedInvoicePortal();

    expect(filterLineRows(p, all)).toHaveLength(13);
    expect(filterLineRows(p, { ...all, query: "misi" })).toHaveLength(1);
    expect(filterLineRows(p, { ...all, carrier: "none" })).toHaveLength(9);
    expect(filterLineRows(p, { ...all, category: "Üzemanyag" })).toHaveLength(
      2,
    );
  });
});
