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

test("the simulator returns NAV ids and accepts a modify with them, then a finalize", async () => {
  const nav = simulatedNav();
  const client = createEkaerClient(cfg, { fetch: nav.fetch });
  const tcn = (await client.manageTradeCards([create])).result[0]!.tcn!;
  const [found] = (await client.queryTradeCards({ tcn })).result;
  const plan = found!.deliveryPlans[0]!;
  const card = create.operation === "create" ? create.tradeCard : null!;

  const noReason = await client.manageTradeCards([
    {
      operation: "modify",
      tradeCard: {
        ...card,
        tcn,
        deliveryPlans: card.deliveryPlans.map((p) => ({
          ...p,
          id: plan.id!,
          items: p.items.map((i) => ({
            ...i,
            id: plan.itemIds[0]!,
            itemOperation: "modify" as const,
            weightKg: 24360,
          })),
        })),
      },
    },
  ]);
  const modified = await client.manageTradeCards([
    {
      operation: "modify",
      tradeCard: {
        ...card,
        tcn,
        deliveryPlans: card.deliveryPlans.map((p) => ({
          ...p,
          id: plan.id!,
          items: p.items.map((i) => ({
            ...i,
            id: plan.itemIds[0]!,
            itemOperation: "modify" as const,
            weightKg: 24360,
            weightModReasonText: "Mérlegelt nettó",
          })),
        })),
      },
    },
  ]);
  const finalized = await client.manageTradeCards([
    { operation: "finalize", tcn, arrivalDate: new Date() },
  ]);

  expect(plan.itemIds).toHaveLength(1);
  expect(noReason.result[0]).toMatchObject({
    funcCode: "ERROR",
    reasonCode: "TC_MOD_REASON_MISSING",
  });
  expect(modified.result[0]).toMatchObject({ funcCode: "OK", status: "S" });
  expect(nav.cards.get("MJ-2026-000002")!.items[0]!.weight).toBe("24360");
  expect(finalized.result[0]).toMatchObject({ funcCode: "OK", status: "F" });
});
