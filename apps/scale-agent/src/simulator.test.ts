import { expect, test } from "vitest";
import { stableWeight } from "@mine-erp/domain/weighing";
import { DIVISION_KG, indicatorKg, SETTLE_MS } from "./simulator.ts";

const readings = (
  load: { kg: number; since: number },
  untilMs: number,
  seed: number[],
) => {
  let i = 0;
  const random = () => seed[i++ % seed.length]!;
  const out = [];
  for (let at = 0; at <= untilMs; at += 250)
    out.push({ kg: indicatorKg(load, at, random), at });
  return out;
};

test("a settled load is accepted by the API's stability rule at the loaded weight", () => {
  const load = { kg: 38560, since: 0 };

  const kg = stableWeight(
    readings(load, SETTLE_MS + 3000, [0.1, 0.9, 0.5, 0.05]),
    SETTLE_MS + 3000,
  );

  expect(kg).not.toBeNull();
  expect(Math.abs(kg! - 38560)).toBeLessThanOrEqual(DIVISION_KG);
});

test("while the truck rolls on the weight is not stable", () => {
  const load = { kg: 38560, since: 0 };

  const kg = stableWeight(
    readings(load, SETTLE_MS - 250, [0.1, 0.9, 0.5]),
    SETTLE_MS - 250,
  );

  expect(kg).toBeNull();
});

test("an empty bridge settles on zero", () => {
  const load = { kg: 0, since: 0 };

  const kg = indicatorKg(load, SETTLE_MS + 1, () => 0.7);

  expect(kg).toBe(0);
});
