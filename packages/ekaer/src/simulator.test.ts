import { expect, test } from "vitest";
import {
  createEkaerClient,
  loadEkaerConfig,
  type Operation,
  simulatedNav,
} from "./index.ts";

const cfg = loadEkaerConfig({
  EKAER_BASE_URL:
    "https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer",
  EKAER_USER: "erp-teszt",
  EKAER_PASSWORD: "x",
  EKAER_SIGNING_KEY: "simulate",
  EKAER_TAX_NUMBER: "23419791",
});
const create: Operation = {
  operation: "create",
  tradeCard: {
    orderNumber: "MJ-2026-000002",
    tradeType: "D",
    modByCarrierEnabled: false,
    seller: {
      name: "Mészkő-Polgár Kft.",
      vatNumber: "23419791",
      country: "HU",
      address: "1181 Budapest",
    },
    destination: {
      name: "Út Kft.",
      vatNumber: "12345678",
      country: "HU",
      address: "1111 Budapest",
    },
    deliveryPlans: [
      {
        loadLocation: {
          country: "HU",
          zipCode: "8154",
          city: "Polgárdi",
          street: "Somlyói út 18",
        },
        unloadLocation: {
          country: "HU",
          zipCode: "1111",
          city: "Budapest",
          street: "Fő utca 1",
        },
        items: [
          {
            tradeReason: "S",
            productVtsz: "25171010",
            productName: "Zúzottkő",
            weightKg: 24000,
            valueHuf: 240000,
          },
        ],
      },
    ],
  },
};

test("the simulator creates, finds by orderNumber and deletes a report", async () => {
  const nav = simulatedNav();
  const client = createEkaerClient(cfg, { fetch: nav.fetch });

  const created = await client.manageTradeCards([create]);
  const tcn = created.result[0]!.tcn!;
  const found = await client.queryTradeCards({
    insertFromDate: new Date(Date.now() - 3600_000),
    insertToDate: new Date(),
    orderNumber: "MJ-2026-000002",
  });
  const deleted = await client.manageTradeCards([
    { operation: "delete", tcn, reason: "teszt" },
  ]);

  expect(created.result[0]).toMatchObject({ funcCode: "OK", status: "S" });
  expect(found.result.map((c) => c.tcn)).toEqual([tcn]);
  expect(deleted.result[0]).toMatchObject({ funcCode: "OK", status: "I" });
});
