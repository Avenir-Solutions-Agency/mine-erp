import { afterEach, describe, expect, test, vi } from "vitest";
import type { Env } from "./env.ts";
import {
  ScaleController,
  ScaleLive,
  ScaleSimulator,
  sameSecret,
} from "./scale.ts";
import { isUniqueViolation } from "./http.ts";
import { toDomain } from "./weighings.service.ts";
import type { WeighingRow } from "./weighings.repository.ts";

const feed = (scale: ScaleLive, kgs: number[], start = 0, stepMs = 500) =>
  kgs.forEach((kg, i) => scale.add(kg, start + i * stepMs));

describe("ScaleSimulator", () => {
  afterEach(() => vi.useRealTimers());
  const env = (on: boolean) =>
    ({ SCALE_SIMULATOR: on ? "true" : "false" }) as Env;

  test("refuses when SCALE_SIMULATOR is off", () => {
    const sim = new ScaleSimulator(env(false), new ScaleLive());

    expect(() => sim.put("loaded")).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  test("a loaded truck settles to a stable weight", () => {
    vi.useFakeTimers({ now: 0 });
    const scale = new ScaleLive();
    const sim = new ScaleSimulator(env(true), scale);

    sim.put("loaded");
    vi.advanceTimersByTime(7000);

    const { stableKg, online } = scale.live(Date.now());
    sim.onModuleDestroy();
    expect(online).toBe(true);
    expect(stableKg).toBeGreaterThanOrEqual(38560);
    expect(stableKg).toBeLessThanOrEqual(38580);
  });

  test("without SCALE_SIMULATOR the source is always the real scale", () => {
    const sim = new ScaleSimulator(env(false), new ScaleLive());

    const source = sim.source;

    expect(source).toBe("scale");
    expect(() => sim.use("simulator")).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  test("on the real scale, agent readings count and the buttons are refused", () => {
    vi.useFakeTimers({ now: 0 });
    const scale = new ScaleLive();
    const sim = new ScaleSimulator(env(true), scale);
    const controller = new ScaleController(scale, sim);
    sim.use("scale");

    controller.reading({ kg: 24360 });

    expect(scale.live(Date.now()).kg).toBe(24360);
    expect(() => sim.put("loaded")).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });

  test("on the simulator, agent readings are dropped", () => {
    const scale = new ScaleLive();
    const sim = new ScaleSimulator(env(true), scale);
    const controller = new ScaleController(scale, sim);

    controller.reading({ kg: 24360 });

    expect(scale.live().online).toBe(false);
  });

  test("switching the source forgets the previous weights", () => {
    vi.useFakeTimers({ now: 0 });
    const scale = new ScaleLive();
    const sim = new ScaleSimulator(env(true), scale);
    sim.put("loaded");
    vi.advanceTimersByTime(4000);

    sim.use("scale");
    vi.advanceTimersByTime(1000);

    expect(scale.live(Date.now()).online).toBe(false);
  });
});

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
