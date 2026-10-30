import { describe, expect, test } from "vitest";
import {
  autoEkaerDecision,
  ekaerProblems,
  fillerToHuf,
  loadValueFiller,
  parseHuAddress,
  type ReportInput,
  vatNumber8,
} from "./ekaer";

describe("parseHuAddress", () => {
  test("reads zip-first and zip-last forms", () => {
    const forms = [
      "8154 Polgárdi, Somlyói út 18",
      "Polgárdi, Somlyói út 18, 8154",
    ];

    const parsed = forms.map(parseHuAddress);

    expect(parsed).toEqual([
      { zipCode: "8154", city: "Polgárdi", street: "Somlyói út 18" },
      { zipCode: "8154", city: "Polgárdi", street: "Somlyói út 18" },
    ]);
  });

  test("rejects an address without zip or town", () => {
    const parsed = [
      parseHuAddress("Somlyói út 18"),
      parseHuAddress(null),
      parseHuAddress(""),
    ];

    expect(parsed).toEqual([null, null, null]);
  });
});

test("vatNumber8 and fillerToHuf convert at the EKÁER edge", () => {
  const values = [
    vatNumber8("12345678-2-42"),
    vatNumber8("1234"),
    fillerToHuf(24_360_050n),
    fillerToHuf(149n),
  ];

  expect(values).toEqual(["12345678", null, 243_601, 1]);
});

describe("ekaerProblems", () => {
  const ok: ReportInput = {
    weighingStatus: "open",
    plate: "AACG971",
    customer: {
      name: "Út Kft.",
      taxNumber: "12345678-2-42",
      address: "1111 Budapest, Fő utca 1",
    },
    product: { name: "Zúzottkő 22/63", vtsz: "25171010", ekaerRequired: true },
    plannedKg: 24_000,
    valueFiller: 24_000_000n,
  };

  test("a complete input has no problems", () => {
    expect(ekaerProblems(ok)).toEqual([]);
  });

  test("accepts paper-ticket load and unload places in address form", () => {
    const paper: ReportInput = {
      ...ok,
      loadingAddress: "8000 Székesfehérvár, 020195/3 hrsz.",
      unloadingAddress: "2063 Óbarok, 47.495861, 18.561926",
    };

    const problems = ekaerProblems(paper);

    expect(problems).toEqual([]);
  });

  test("refuses load and unload places without zip and town", () => {
    const paper: ReportInput = {
      ...ok,
      loadingAddress: "Csúcsoshegy",
      unloadingAddress: "Óbarok",
    };

    const problems = ekaerProblems(paper);

    expect(problems).toEqual([
      "A lerakodási cím „irányítószám település, utca” formában kell.",
      "A felrakodási cím „irányítószám település, utca” formában kell.",
    ]);
  });

  test("names every missing piece in Hungarian", () => {
    const bad: ReportInput = {
      ...ok,
      weighingStatus: "void",
      customer: { name: "X", taxNumber: null, address: "Budapest" },
      product: { name: "Homok", vtsz: "2505", ekaerRequired: false },
      plannedKg: 0,
      valueFiller: 0n,
    };

    const problems = ekaerProblems(bad);

    expect(problems).toHaveLength(7);
    expect(problems[0]).toMatch(/Sztornózott/);
  });
});

describe("autoEkaerDecision", () => {
  const report = {
    weighingStatus: "completed" as const,
    plate: "AACG971",
    customer: {
      name: "Út Kft.",
      taxNumber: "12345678-2-42",
      address: "1111 Budapest, Fő utca 1",
    },
    product: { name: "Zúzottkő 22/63", vtsz: "25171010", ekaerRequired: true },
  };

  test("files with net tonnes × price when everything is there", () => {
    const d = autoEkaerDecision({
      enabled: true,
      netKg: 24_360,
      pricePerTonneFiller: 1_000_000n,
      report,
    });

    expect(d).toEqual({ file: true, valueFiller: 24_360_000n });
  });

  test("stays manual when switched off, unpriced or incomplete, and says why", () => {
    const off = autoEkaerDecision({
      enabled: false,
      netKg: 24_360,
      pricePerTonneFiller: 1_000_000n,
      report,
    });
    const unpriced = autoEkaerDecision({
      enabled: true,
      netKg: 24_360,
      pricePerTonneFiller: null,
      report,
    });
    const noCustomer = autoEkaerDecision({
      enabled: true,
      netKg: 24_360,
      pricePerTonneFiller: 1_000_000n,
      report: { ...report, customer: null },
    });

    expect(off).toEqual({
      file: false,
      reasons: ["Az automatikus EKÁER-bejelentés ki van kapcsolva."],
    });
    expect(unpriced).toMatchObject({
      file: false,
      reasons: [expect.stringMatching(/nincs ár/)],
    });
    expect(noCustomer).toMatchObject({
      file: false,
      reasons: [expect.stringMatching(/vevőt/)],
    });
  });

  test("loadValueFiller rounds half up to the fillér", () => {
    const v = loadValueFiller(1, 1_500n);

    expect(v).toBe(2n);
  });
});
