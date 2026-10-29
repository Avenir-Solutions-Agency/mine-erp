import {
  createEkaerClient,
  EkaerOutcomeUnknownError,
  loadEkaerConfig,
  simulatedNav,
} from "@mine-erp/ekaer";
import { describe, expect, test } from "vitest";
import {
  deleteReport,
  fileReport,
  PermanentEkaerError,
  type ReportStore,
  type ReportView,
} from "./ekaer.ts";

const cfg = loadEkaerConfig({
  EKAER_BASE_URL:
    "https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer",
  EKAER_USER: "erp-teszt",
  EKAER_PASSWORD: "x",
  EKAER_SIGNING_KEY: "simulate",
  EKAER_TAX_NUMBER: "23419791",
});

const report = (over: Partial<ReportView> = {}): ReportView => ({
  id: "r1",
  status: "pending",
  orderNumber: "MJ-2026-000002",
  tcn: null,
  plannedKg: 24_000,
  value: 24_000_000n,
  createdAt: new Date(),
  deleteReason: null,
  weighing: { status: "open", plate: "AACG971" },
  customer: {
    name: "Út Kft.",
    taxNumber: "12345678-2-42",
    address: "1111 Budapest, Fő utca 1",
  },
  product: { name: "Zúzottkő 22/63", vtsz: "25171010", ekaerRequired: true },
  ...over,
});

/** In-memory store: one report, a log of what was written. */
function memoryStore(r: ReportView) {
  const writes: string[] = [];
  const store: ReportStore = {
    load: async () => r,
    active: async (_, tcn) => {
      r = { ...r, status: "active", tcn };
      writes.push(`active ${tcn}`);
    },
    failed: async (_, error) => {
      r = { ...r, status: "failed" };
      writes.push(`failed ${error}`);
    },
    deleted: async () => {
      r = { ...r, status: "deleted" };
      writes.push("deleted");
    },
    deleteRefused: async (_, error) => {
      writes.push(`refused ${error}`);
    },
  };
  return { store, writes, get: () => r };
}

describe("fileReport", () => {
  test("files a new report and stores the EKÁER number", async () => {
    const nav = simulatedNav();
    const m = memoryStore(report());

    const tcn = await fileReport(
      m.store,
      createEkaerClient(cfg, { fetch: nav.fetch }),
      "r1",
    );

    expect(tcn).toMatch(/^E\d+/);
    expect(m.writes).toEqual([`active ${tcn}`]);
    expect(nav.cards.size).toBe(1);
  });

  test("after a lost response the retry adopts the report NAV already has", async () => {
    const nav = simulatedNav();
    let calls = 0;
    // The create reaches NAV, but the answer is lost.
    const flaky: typeof fetch = async (url, init) => {
      const res = await nav.fetch(url, init);
      if (String(url).endsWith("manageTradeCards") && calls++ === 0)
        throw new DOMException("timeout", "TimeoutError");
      return res;
    };
    const client = createEkaerClient(cfg, { fetch: flaky });
    const m = memoryStore(report());

    const first = fileReport(m.store, client, "r1");
    await expect(first).rejects.toBeInstanceOf(EkaerOutcomeUnknownError);
    const tcn = await fileReport(m.store, client, "r1");

    expect(nav.cards.size).toBe(1);
    expect(tcn).toBe([...nav.cards.values()][0]!.tcn);
  });

  test("missing data fails at once with Hungarian reasons and files nothing", async () => {
    const nav = simulatedNav();
    const m = memoryStore(report({ customer: null }));

    const call = fileReport(
      m.store,
      createEkaerClient(cfg, { fetch: nav.fetch }),
      "r1",
    );

    await expect(call).rejects.toBeInstanceOf(PermanentEkaerError);
    expect(m.writes[0]).toMatch(/^failed Válasszon vevőt/);
    expect(nav.cards.size).toBe(0);
  });
});

test("deleteReport sends the person's reason and marks the report deleted", async () => {
  const nav = simulatedNav();
  const client = createEkaerClient(cfg, { fetch: nav.fetch });
  const m = memoryStore(report());
  const tcn = await fileReport(m.store, client, "r1");
  const pending = memoryStore({
    ...m.get(),
    status: "deleting",
    tcn,
    deleteReason: "Téves rendszám",
  });

  await deleteReport(pending.store, client, "r1");

  expect(pending.writes).toEqual(["deleted"]);
  expect([...nav.cards.values()][0]!.status).toBe("I");
});
