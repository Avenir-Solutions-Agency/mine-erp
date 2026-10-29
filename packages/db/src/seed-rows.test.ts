import { expect, test } from "vitest";
import { toMachine, toVehicle } from "./seed-rows.ts";

test("toVehicle normalises the plate and parses numbers", () => {
  const row = {
    Rendszám: "abc 123",
    "Teljesítmény (kW)": "1 234",
    Évjárat: "2019",
    Üzembentartó: "Mészkő-Polgár Kft.",
    Megjegyzés: "",
  };

  const v = toVehicle(row);

  expect(v).toMatchObject({
    plate: "ABC123",
    powerKw: 1234,
    year: 2019,
    operator: "Mészkő-Polgár Kft.",
    note: null,
  });
});

test("toVehicle skips rows without a plate", () => {
  const row = { Rendszám: "", Kategória: "nyerges" };

  const v = toVehicle(row);

  expect(v).toBeNull();
});

test("toMachine keeps every non-empty column in attributes", () => {
  const row = { Megnevezés: "Volvo L150", Gyártó: "Volvo", Üres: "" };

  const m = toMachine(row);

  expect(m).toMatchObject({ name: "Volvo L150", make: "Volvo" });
  expect(m?.attributes).toEqual({ Megnevezés: "Volvo L150", Gyártó: "Volvo" });
});
