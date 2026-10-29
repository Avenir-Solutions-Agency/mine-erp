import { describe, expect, test } from "vitest";
import type { WeighingDto } from "@mine-erp/contracts";
import { renderTicketHtml } from "./ticket.ts";

const base: WeighingDto = {
  id: "0190f2a4-0000-7000-8000-000000000000",
  ticketNumber: "MJ-2026-000001",
  status: "completed",
  plate: "AACG971",
  trailerPlate: null,
  customer: "Út Kft.",
  material: "22/63",
  note: null,
  firstKg: 14200,
  firstAt: "2026-10-29T08:00:00Z",
  secondKg: 38560,
  secondAt: "2026-10-29T08:40:00Z",
  grossKg: 38560,
  tareKg: 14200,
  netKg: 24360,
  savedTare: false,
  voidReason: null,
  ekaer: null,
  shipment: { registryNumber: "SZ-2026-000001", status: "registered" },
};

describe("renderTicketHtml", () => {
  test("shows the ticket number, plate and net weight in Hungarian format", () => {
    const html = renderTicketHtml(base);

    expect(html).toContain("MJ-2026-000001");
    expect(html).toContain("AACG971");
    expect(html).toContain("SZ-2026-000001");
    expect(html).toMatch(/24\s360 kg/);
    expect(html).not.toContain("SZTORNÓ");
  });

  test("escapes text typed by the operator", () => {
    const w = { ...base, customer: '<img src=x onerror="alert(1)">' };

    const html = renderTicketHtml(w);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("stamps a void ticket and prints the reason", () => {
    const w = {
      ...base,
      status: "void" as const,
      voidReason: "rossz rendszám",
    };

    const html = renderTicketHtml(w);

    expect(html).toContain("SZTORNÓ");
    expect(html).toContain("rossz rendszám");
  });

  test("prints the EKÁER number of an active report and the site address", () => {
    const w = {
      ...base,
      ekaer: {
        id: base.id,
        status: "active" as const,
        tcn: "E123456789012",
        error: null,
      },
    };

    const html = renderTicketHtml(w);

    expect(html).toContain("EKÁER-szám");
    expect(html).toContain("E123456789012");
    expect(html).toContain("8154 Polgárdi, Somlyói út 18");
  });

  test("times are shown in Budapest time", () => {
    const html = renderTicketHtml(base);

    expect(html).toContain("2026. 10. 29. 9:00");
  });
});
