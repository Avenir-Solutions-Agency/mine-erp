import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import golden from "./__fixtures__/demo-seed.json";
import { createDemo, type DemoEnv } from "./engine";

// Same pinned clock and PRNG as scripts/demo-golden.js, which produced the fixture from the original page.
function pinnedEnv(): DemoEnv {
  const NOW = new Date("2026-10-03T09:30:00").getTime();
  let seed = 42;
  const random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // The page's embedded runtime script draws one random number before the demo code runs.
  random();
  return {
    now: () => NOW,
    random,
    sha256: async (s) => {
      const b = await webcrypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(s),
      );
      return [...new Uint8Array(b)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    },
  };
}

// The serializer of scripts/demo-golden.js: Dates as {$date}, functions and undefined dropped.
function plain(v: unknown, seen = new WeakSet<object>()): unknown {
  if (v instanceof Date) return { $date: v.toISOString() };
  if (typeof v === "function") return undefined;
  if (v && typeof v === "object") {
    if (seen.has(v)) return { $ref: true };
    seen.add(v);
    let out: unknown;
    if (Array.isArray(v))
      out = v.map((x) => (typeof x === "function" ? null : plain(x, seen)));
    else {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        const p = plain(x, seen);
        if (p !== undefined) o[k] = p;
      }
      out = o;
    }
    seen.delete(v);
    return out;
  }
  return v;
}

describe("demo engine", () => {
  it(
    "reproduces the original demo state after bootstrap",
    { timeout: 120_000 },
    async () => {
      const demo = createDemo(pinnedEnv());
      await demo.settled();
      const actual = JSON.parse(
        JSON.stringify({ S: plain(demo.S), SEQ: plain(demo.SEQ) }),
      );
      for (const key of Object.keys(golden.S)) {
        expect
          .soft(actual.S[key], `S.${key}`)
          .toEqual((golden.S as Record<string, unknown>)[key]);
      }
      expect(Object.keys(actual.S).sort()).toEqual(
        Object.keys(golden.S).sort(),
      );
      expect(actual.SEQ).toEqual(golden.SEQ);
    },
  );
});
