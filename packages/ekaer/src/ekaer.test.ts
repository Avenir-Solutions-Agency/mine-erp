import { readFile } from "node:fs/promises";
import { describe, expect, test, vi } from "vitest";
import {
  createEkaerClient,
  EkaerExpiredPasswordError,
  EkaerOutcomeUnknownError,
  EkaerSchemaError,
  EkaerTransportError,
  loadEkaerConfig,
  type Operation,
} from "./index.ts";
import { requestSignature, utcStamp } from "./sign.ts";
import { maskRequest, manageTradeCardsXml, queryTradeCardsXml } from "./xml.ts";
import { validateRequest } from "./validate.ts";

const TEST_URL =
  "https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer";
const env = {
  EKAER_BASE_URL: TEST_URL,
  EKAER_USER: "erp-teszt",
  EKAER_PASSWORD: "jelszo",
  EKAER_SIGNING_KEY: "Elek65Titkos",
  EKAER_TAX_NUMBER: "23419791",
};
const cfg = loadEkaerConfig(env);
const at = new Date("2026-10-29T08:00:00.123Z");

const create: Operation = {
  operation: "create",
  tradeCard: {
    orderNumber: "SZ-2026-000123",
    tradeType: "D",
    modByCarrierEnabled: false,
    seller: {
      name: "Mészkő-Polgár Kft.",
      vatNumber: "23419791",
      country: "HU",
      address: "8154 Polgárdi",
    },
    destination: {
      name: "Út & Híd Kft.",
      vatNumber: "12345678",
      country: "HU",
      address: "1111 Budapest",
    },
    vehicle: { plateNumber: "AACG971", country: "HU" },
    deliveryPlans: [
      {
        loadLocation: {
          country: "HU",
          zipCode: "8154",
          city: "Polgárdi",
          street: "Kőbánya",
        },
        unloadLocation: {
          country: "HU",
          zipCode: "1111",
          city: "Budapest",
          street: "Fő",
        },
        items: [
          {
            tradeReason: "S",
            productVtsz: "25171010",
            productName: "Zúzottkő 22/63",
            weightKg: 24360,
            valueHuf: 243600,
          },
        ],
      },
    ],
  },
};

describe("signing", () => {
  test("matches NAV's published test vector", () => {
    const at2015 = new Date("2015-01-15T12:25:45Z");

    const signature = requestSignature("TSTKFT1222564", at2015, "Elek65Titkos");

    expect(utcStamp(at2015)).toBe("20150115122545");
    expect(signature).toBe(
      "AF84DC456B82234E67550C80169E517FBDAB4403607293985DECB09F534D9F73FADAABEFEE932554FABBC49F6E8F74A5DD54EA359D6B7644D95CFF3530AFB889",
    );
  });
});

describe("config", () => {
  test("has no default base URL", () => {
    const { EKAER_BASE_URL: _, ...withoutUrl } = env;

    const load = () => loadEkaerConfig(withoutUrl);

    expect(load).toThrow(/EKAER_BASE_URL/);
  });

  test("refuses the NAV production host outside production, and plain http", () => {
    const prod = {
      ...env,
      EKAER_BASE_URL:
        "https://import.ekaer.nav.gov.hu/TradeCardManagementService/customer",
    };

    const dev = () => loadEkaerConfig(prod);
    const http = () =>
      loadEkaerConfig({
        ...env,
        EKAER_BASE_URL: "http://import-test.ekaer.nav.gov.hu/x",
      });

    expect(dev).toThrow(/production/);
    expect(http).toThrow(/https/);
    expect(
      loadEkaerConfig({ ...prod, NODE_ENV: "production" }).baseUrl,
    ).toContain("import.ekaer");
  });

  test("never puts secret values in the error message", () => {
    const bad = { ...env, EKAER_SIGNING_KEY: "x" };

    const load = () => loadEkaerConfig(bad);

    expect(load).toThrow(/EKAER_SIGNING_KEY/);
    expect(load).not.toThrow(/jelszo/);
  });
});

describe("XML against NAV's 2.2 XSD", () => {
  test("create, finalize and delete requests are schema-valid", async () => {
    const ops: Operation[] = [
      create,
      { operation: "finalize", tcn: "E0000000000123", arrivalDate: at },
      {
        operation: "delete",
        tcn: "E0000000000124",
        reason: "Téves bejelentés",
      },
    ];

    const errors = await validateRequest(
      manageTradeCardsXml(ops, cfg, "a".repeat(32), at),
    );

    expect(errors).toEqual([]);
  });

  test("query requests by tcn and by parameters are schema-valid", async () => {
    const byTcn = queryTradeCardsXml(
      { tcn: "E0000000000123" },
      cfg,
      "b".repeat(32),
      at,
    );
    const byParams = queryTradeCardsXml(
      {
        insertFromDate: new Date("2026-10-01T00:00:00Z"),
        insertToDate: at,
        orderNumber: "SZ-2026-000123",
      },
      cfg,
      "c".repeat(32),
      at,
    );

    const errors = [
      ...(await validateRequest(byTcn)),
      ...(await validateRequest(byParams)),
    ];

    expect(errors).toEqual([]);
  });

  test("escapes text and masks credentials for evidence", () => {
    const xml = manageTradeCardsXml([create], cfg, "d".repeat(32), at);

    const masked = maskRequest(xml);

    expect(xml).toContain("Út &#38; Híd Kft.");
    expect(xml).toContain("<timestamp>2026-10-29T08:00:00Z</timestamp>");
    expect(masked).toContain("<passwordHash>***</passwordHash>");
    expect(masked).toContain("<requestSignature>***</requestSignature>");
  });
});

describe("client", () => {
  const response = (body: string, status = 200) =>
    vi.fn(
      async () =>
        new Response(body, { status, headers: { "content-type": "text/xml" } }),
    );

  test("parses operation results, tcn, status and warnings", async () => {
    const xml = await readFile(
      new URL("../fixtures/manage-create-ok.xml", import.meta.url),
      "utf8",
    );
    const fetch = response(xml);
    const client = createEkaerClient(cfg, {
      fetch,
      now: () => at,
      requestId: () => "e".repeat(32),
    });

    const r = await client.manageTradeCards([create]);

    expect(fetch).toHaveBeenCalledWith(
      `${TEST_URL}/manageTradeCards`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(r.funcCode).toBe("OK");
    expect(r.result).toEqual([
      {
        index: 1,
        operation: "create",
        funcCode: "WARNING",
        reasonCode: "SUCCESS",
        msg: "Feldolgozva",
        tcn: "E0000000000123",
        status: "S",
        warnings: ["TC_WRONG_ZIP_CITY_WARN"],
      },
    ]);
    expect(r.requestXml).not.toMatch(/<passwordHash>[0-9A-F]/);
  });

  test("a refused connection is safe to retry; a timeout after sending is not", async () => {
    const refused = vi.fn(async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    });
    const timedOut = vi.fn(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });

    const a = createEkaerClient(cfg, { fetch: refused }).queryTradeCards({
      tcn: "E0000000000123",
    });
    const b = createEkaerClient(cfg, { fetch: timedOut }).manageTradeCards([
      create,
    ]);

    await expect(a).rejects.toBeInstanceOf(EkaerTransportError);
    await expect(b).rejects.toBeInstanceOf(EkaerOutcomeUnknownError);
  });

  test("an expired password is its own error", async () => {
    const fetch = response("<error>EXPIRED_PASSWORD</error>", 400);

    const call = createEkaerClient(cfg, { fetch }).queryTradeCards({
      tcn: "E0000000000123",
    });

    await expect(call).rejects.toBeInstanceOf(EkaerExpiredPasswordError);
  });

  test("a schema-invalid request is never sent", async () => {
    const fetch = response("");
    const bad = {
      ...create,
      tradeCard: { ...create.tradeCard, tradeType: "X" as "D" },
    };

    const call = createEkaerClient(cfg, { fetch }).manageTradeCards([bad]);

    await expect(call).rejects.toBeInstanceOf(EkaerSchemaError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
