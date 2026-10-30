import { expect, test } from "vitest";
import {
  type DeliveryNoteData,
  renderDeliveryNoteHtml,
} from "./delivery-note.ts";

const base: DeliveryNoteData = {
  number: "SZ-2026-000001",
  cancelled: false,
  shippedAt: "2026-10-29T08:40:00Z",
  plate: "AACG971",
  trailerPlate: null,
  customer: {
    name: "Út Kft.",
    taxNumber: "12345678-2-42",
    address: "1111 Budapest, Fő utca 1",
  },
  product: { name: "Zúzottkő 22/63", vtsz: "25171010" },
  netKg: 24_360,
  ticketNumber: "MJ-2026-000001",
  ekaerTcn: "E123456789012",
};

test("the delivery note carries both parties, the load and the EKÁER number", () => {
  const html = renderDeliveryNoteHtml(base);

  expect(html).toContain("SZ-2026-000001");
  expect(html).toContain("Mészkő-Polgár Kft.");
  expect(html).toContain("12345678-2-42");
  expect(html).toContain("8154 Polgárdi, Somlyói út 18");
  expect(html).toMatch(/24\s360 kg/);
  expect(html).toMatch(/24,360 t/);
  expect(html).toContain("E123456789012");
  expect(html).not.toContain("SZTORNÓ");
});

test("customer text is escaped and a cancelled note is stamped", () => {
  const html = renderDeliveryNoteHtml({
    ...base,
    cancelled: true,
    customer: { ...base.customer, name: "<script>x</script>" },
  });

  expect(html).not.toContain("<script>x");
  expect(html).toContain("SZTORNÓ");
});
