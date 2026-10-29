import { describe, expect, test } from "vitest";
import { ScaleLive, sameSecret } from "./scale.ts";
import { isUniqueViolation } from "./http.ts";
import { toDomain } from "./weighings.service.ts";
import type { WeighingRow } from "./weighings.repository.ts";

const feed = (scale: ScaleLive, kgs: number[], start = 0, stepMs = 500) =>
  kgs.forEach((kg, i) => scale.add(kg, start + i * stepMs));

describe("ScaleLive", () => {
  test("an empty bridge is reported as empty, not as moving", () => {
    const scale = new ScaleLive();
    feed(scale, [0, 0, 0, 0, 0, 0, 0]);

    const live = scale.live(3000);

    expect(live).toEqual({ kg: 0, stableKg: null, online: true, empty: true });
  });

  test("reports a stable weight after three still seconds", () => {
    const scale = new ScaleLive();
    feed(scale, [24360, 24360, 24370, 24360, 24360, 24360, 24360]);

    const live = scale.live(3000);

    expect(live).toEqual({
      kg: 24360,
      stableKg: 24360,
      online: true,
      empty: false,
    });
  });

  test("goes offline when the agent stops sending", () => {
    const scale = new ScaleLive();
    feed(scale, [24360, 24360, 24360, 24360, 24360, 24360, 24360]);

    const live = scale.live(3000 + 2500);

    expect(live).toEqual({
      kg: null,
      stableKg: null,
      online: false,
      empty: false,
    });
  });

  test("refuses to record while the truck is moving or the scale is offline", () => {
    const moving = new ScaleLive();
    feed(moving, [8000, 15000, 22000, 24000, 24300, 24360, 24360]);
    const silent = new ScaleLive();

    const notStable = () => moving.requireStable(3000);
    const offline = () => silent.requireStable(3000);

    expect(notStable).toThrow(expect.objectContaining({ status: 409 }));
    expect(offline).toThrow(expect.objectContaining({ status: 503 }));
  });
});

test("sameSecret compares tokens of any length without throwing", () => {
  const token = "x".repeat(40);

  const results = [
    sameSecret(token, token),
    sameSecret("short", token),
    sameSecret("", token),
  ];

  expect(results).toEqual([true, false, false]);
});

test("isUniqueViolation finds the Postgres error inside Drizzle's wrapper", () => {
  const pg = { code: "23505", constraint_name: "weighing_one_open_per_plate" };
  const wrapped = Object.assign(new Error("query failed"), { cause: pg });

  const hits = [
    isUniqueViolation(wrapped, "weighing_one_open_per_plate"),
    isUniqueViolation(wrapped, "other"),
    isUniqueViolation(new Error("x"), "weighing_one_open_per_plate"),
  ];

  expect(hits).toEqual([true, false, false]);
});

test("toDomain turns a voided completed row back into a completed 'before'", () => {
  const at = new Date("2026-10-29T08:00:00Z");
  const row = {
    status: "void",
    firstKg: 14200,
    firstAt: at,
    secondKg: 38560,
    secondAt: at,
    grossKg: 38560,
    tareKg: 14200,
    netKg: 24360,
    savedTare: false,
    voidReason: "teszt",
  } as WeighingRow;

  const w = toDomain(row);

  expect(w).toMatchObject({
    status: "void",
    before: { status: "completed", netKg: 24360 },
  });
});
