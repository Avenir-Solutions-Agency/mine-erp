import { expect, test } from "vitest";
import { formatRegistryNumber, registrationProblems } from "./shipment";

test("formatRegistryNumber pads the yearly sequence to six digits", () => {
  const n = formatRegistryNumber(2026, 123);

  expect(n).toBe("SZ-2026-000123");
});

test("a completed weighing with customer and product can be registered", () => {
  const input = {
    weighingStatus: "completed" as const,
    netKg: 24_360,
    customer: "Út Kft.",
    product: "Zúzottkő 22/63",
    alreadyRegistered: false,
  };

  expect(registrationProblems(input)).toEqual([]);
});

test("every missing piece is named in Hungarian", () => {
  const input = {
    weighingStatus: "open" as const,
    netKg: null,
    customer: null,
    product: null,
    alreadyRegistered: true,
  };

  const problems = registrationProblems(input);

  expect(problems).toHaveLength(5);
  expect(problems[1]).toBe("Csak lezárt mérlegelés vehető nyilvántartásba.");
});
