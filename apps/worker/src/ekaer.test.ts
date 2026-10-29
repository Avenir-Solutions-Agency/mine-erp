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
  finalizeReport,
  modifyReport,
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
  requestedKg: null,
  changeReason: null,
  arrivalAt: null,
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
    modified: async (_, kg) => {
      r = { ...r, status: "active", plannedKg: kg, requestedKg: null };
      writes.push(`modified ${kg}`);
    },
    finalized: async () => {
      r = { ...r, status: "finalized" };
      writes.push("finalized");
    },
    changeRefused: async (_, error) => {
      r = { ...r, status: "active", requestedKg: null };
      writes.push(`change refused ${error}`);
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

describe("after the second weighing", () => {
  async function filed() {
    const nav = simulatedNav();
    const client = createEkaerClient(cfg, { fetch: nav.fetch });
    const m = memoryStore(report());
    const tcn = await fileReport(m.store, client, "r1");
    return { nav, client, tcn, base: m.get() };
  }

  test("modifyReport sends the weighed net with the reason and NAV's ids", async () => {
    const { nav, client, base } = await filed();
    const m = memoryStore({
      ...base,
      status: "modifying",
      requestedKg: 24_360,
      changeReason: "Mérlegelt nettó tömeg",
    });

    await modifyReport(m.store, client, "r1");

    expect(m.writes).toEqual(["modified 24360"]);
    expect(nav.cards.get("MJ-2026-000002")!.items[0]!.weight).toBe("24360");
  });

  test("finalizeReport closes the report, and a repeat after a lost answer does not resend", async () => {
    const { nav, client, base } = await filed();
    const waiting = { ...base, status: "finalizing", arrivalAt: new Date() };
    const first = memoryStore(waiting);
    const again = memoryStore(waiting);

    await finalizeReport(first.store, client, "r1");
    await finalizeReport(again.store, client, "r1");

    expect(first.writes).toEqual(["finalized"]);
    expect(again.writes).toEqual(["finalized"]);
    expect(nav.cards.get("MJ-2026-000002")!.status).toBe("F");
  });

  test("a modify on a deleted report is refused and the report stays active in the ERP", async () => {
    const { client, tcn, base } = await filed();
    await client.manageTradeCards([
      { operation: "delete", tcn, reason: "teszt" },
    ]);
    const m = memoryStore({
      ...base,
      status: "modifying",
      requestedKg: 24_360,
      changeReason: "x",
    });

    await modifyReport(m.store, client, "r1");

    expect(m.writes[0]).toMatch(
      /^change refused A NAV-nál a bejelentés nem aktív/,
    );
  });
});
