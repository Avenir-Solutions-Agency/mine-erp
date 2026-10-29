import { describe, expect, test } from "vitest";
import {
  type Weighing,
  firstWeighing,
  formatTicketNumber,
  normalizePlate,
  secondWeighing,
  stableWeight,
  voidWeighing,
  weighingWithSavedTare,
} from "./weighing";

const series = (kgs: number[], stepMs = 500, start = 0) =>
  kgs.map((kg, i) => ({ kg, at: start + i * stepMs }));

const unwrap = (r: { ok: boolean; value?: Weighing }) => {
  if (!r.ok || !r.value) throw new Error("expected ok");
  return r.value;
};

describe("stableWeight", () => {
  test("returns the last weight once it stayed within tolerance for the whole window", () => {
    const readings = series([24360, 24360, 24380, 24370, 24360, 24360, 24360]);

    const kg = stableWeight(readings, 3000);

    expect(kg).toBe(24360);
  });

  test("returns null while the truck is still rolling on", () => {
    const readings = series([8000, 15000, 22000, 24000, 24300, 24360, 24360]);

    const kg = stableWeight(readings, 3000);

    expect(kg).toBeNull();
  });

  test("returns null when the readings do not reach back a full window", () => {
    const readings = series([24360, 24360], 500, 2000);

    const kg = stableWeight(readings, 3000);

    expect(kg).toBeNull();
  });

  test("returns null for an empty bridge below the minimum weight", () => {
    const readings = series([20, 20, 20, 20, 20, 20, 20]);

    const kg = stableWeight(readings, 3000);

    expect(kg).toBeNull();
  });

  test("rounds decimal indicator values to whole kilograms", () => {
    const readings = series([
      24360.4, 24360.4, 24360.4, 24360.4, 24360.4, 24360.4, 24360.4,
    ]);

    const kg = stableWeight(readings, 3000);

    expect(kg).toBe(24360);
  });
});

describe("two-pass weighing", () => {
  test("loading: empty truck in, loaded truck out gives gross, tare and net", () => {
    const open = unwrap(firstWeighing(14200, 1));

    const done = unwrap(secondWeighing(open, 38560, 2));

    expect(done).toMatchObject({
      status: "completed",
      grossKg: 38560,
      tareKg: 14200,
      netKg: 24360,
      savedTare: false,
    });
  });

  test("delivery: loaded truck in, empty truck out gives the same net", () => {
    const open = unwrap(firstWeighing(38560, 1));

    const done = unwrap(secondWeighing(open, 14200, 2));

    expect(done).toMatchObject({ grossKg: 38560, tareKg: 14200, netKg: 24360 });
  });

  test("rejects a second weighing equal to the first", () => {
    const open = unwrap(firstWeighing(14200, 1));

    const result = secondWeighing(open, 14200, 2);

    expect(result).toMatchObject({ ok: false, code: "same_weight" });
  });

  test("rejects a second weighing on a completed record", () => {
    const done = unwrap(
      secondWeighing(unwrap(firstWeighing(14200, 1)), 38560, 2),
    );

    const result = secondWeighing(done, 40000, 3);

    expect(result).toMatchObject({ ok: false, code: "not_open" });
  });

  test("rejects fractional or non-positive weights", () => {
    const results = [
      firstWeighing(0, 1),
      firstWeighing(-5, 1),
      firstWeighing(100.5, 1),
    ];

    const codes = results.map((r) => (r.ok ? "ok" : r.code));

    expect(codes).toEqual([
      "invalid_weight",
      "invalid_weight",
      "invalid_weight",
    ]);
  });
});

describe("saved tare", () => {
  test("one pass gives net from the vehicle's saved tare", () => {
    const result = weighingWithSavedTare(38560, 14200, 1);

    expect(unwrap(result)).toMatchObject({ netKg: 24360, savedTare: true });
  });

  test("rejects a saved tare that is not lower than the bridge weight", () => {
    const result = weighingWithSavedTare(14000, 14200, 1);

    expect(result).toMatchObject({ ok: false, code: "tare_not_lower" });
  });
});

describe("void", () => {
  test("keeps the record and its reason instead of deleting it", () => {
    const open = unwrap(firstWeighing(14200, 1));

    const voided = unwrap(voidWeighing(open, "  rossz rendszám  "));

    expect(voided).toEqual({
      status: "void",
      voidReason: "rossz rendszám",
      before: open,
    });
  });

  test("requires a reason and cannot void twice", () => {
    const open = unwrap(firstWeighing(14200, 1));
    const voided = unwrap(voidWeighing(open, "teszt"));

    const noReason = voidWeighing(open, " ");
    const twice = voidWeighing(voided, "újra");

    expect(noReason).toMatchObject({ ok: false, code: "reason_required" });
    expect(twice).toMatchObject({ ok: false, code: "already_void" });
  });
});

test("formatTicketNumber pads the yearly sequence to six digits", () => {
  const number = formatTicketNumber(2026, 123);

  expect(number).toBe("MJ-2026-000123");
});

test("normalizePlate ignores case, spaces and dashes", () => {
  const plates = ["abc-123", "ABC 123", "aa bc-123"];

  const normal = plates.map(normalizePlate);

  expect(normal).toEqual(["ABC123", "ABC123", "AABC123"]);
});
