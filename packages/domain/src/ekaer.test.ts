import { describe, expect, test } from "vitest";
import {
  ekaerProblems,
  fillerToHuf,
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
