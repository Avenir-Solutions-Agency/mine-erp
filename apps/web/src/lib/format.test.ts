import { describe, expect, it } from "vitest";
import { formatHuf, formatKg } from "./format";

const nbsp = " ";

describe("formatKg", () => {
  it("groups thousands with a non-breaking space and appends kg", () => {
    const kg = 24360;

    const result = formatKg(kg);

    expect(result).toBe(`24${nbsp}360${nbsp}kg`);
  });
});

describe("formatHuf", () => {
  it("formats whole forints from fillér without decimals", () => {
    const filler = BigInt(2436000);

    const result = formatHuf(filler);

    expect(result).toBe(`24${nbsp}360${nbsp}Ft`);
  });

  it("keeps fillér precision when the amount is not whole", () => {
    const filler = BigInt(12345);

    const result = formatHuf(filler);

    expect(result).toBe(`123,45${nbsp}Ft`);
  });
});
