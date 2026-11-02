import { expect, test } from "vitest";
import { portalWeightKg } from "./portal-weight.ts";

test("finds a known live-weight key at the top level", () => {
  const status = { ok: true, live_weight_kg: 38560 };

  const kg = portalWeightKg(status);

  expect(kg).toBe(38560);
});

test("finds a nested key and reads a Hungarian-formatted number", () => {
  const status = { ok: true, scale: { weight: "14 200,4" } };

  const kg = portalWeightKg(status);

  expect(kg).toBe(14200);
});

test("a top-level key wins over a nested one", () => {
  const status = { weight: 100, scale: { live_weight_kg: 200 } };

  const kg = portalWeightKg(status);

  expect(kg).toBe(100);
});

test("PORTAL_WEIGHT_FIELD picks the field by dot path", () => {
  const status = { weighing_count: 5, s: { net: 24360.6 } };

  const kg = portalWeightKg(status, "s.net");

  expect(kg).toBe(24361);
});

test("never guesses from unrelated numbers; lists the keys instead", () => {
  const status = { ok: true, weighing_count: 15240, signal: { ok: true } };

  const read = () => portalWeightKg(status);

  expect(read).toThrow("Mezők: ok, weighing_count, signal.ok");
});
