import { expect, test } from "vitest";
import { pace, startPace } from "./pacing.ts";

/** Feeds readings every 500 ms from t=0; returns the times something was sent. */
function sentAt(kgs: number[]): number[] {
  let p = startPace();
  const sent: number[] = [];
  kgs.forEach((kg, i) => {
    const r = pace(p, kg, i * 500);
    if (r.send) sent.push(i * 500);
    p = r.next;
  });
  return sent;
}

test("an empty, still bridge is sent every 5 s once the start-up fast period is over", () => {
  const kgs = Array.from({ length: 81 }, () => 0);

  const sent = sentAt(kgs).filter((t) => t > 30_000);

  expect(sent).toEqual([34_500, 39_500]);
});

test("a change of 20 kg switches to every 0.5 s; a few kg of noise does not", () => {
  const quiet = Array.from({ length: 80 }, (_, i) => (i % 2 ? 5 : 0));
  const kgs = [...quiet, 14_000, 14_010];

  const sent = sentAt(kgs).filter((t) => t >= 35_000);

  expect(sent).toEqual([39_500, 40_000, 40_500]);
});

test("a vehicle standing on the bridge keeps the fast pace for the stability check", () => {
  const kgs = Array.from({ length: 200 }, () => 24_360);

  const sent = sentAt(kgs).filter((t) => t >= 90_000);

  expect(sent.length).toBe(20);
});
