import { expect, test } from "vitest";
import { eventPayload } from "./schema.ts";

test("event payloads with fillér bigints serialize instead of throwing", () => {
  const column = eventPayload("payload");
  const toDriver = (
    column as unknown as {
      config: { customTypeParams: { toDriver: (v: unknown) => string } };
    }
  ).config.customTypeParams.toDriver;

  const json = toDriver({ pricePerTonne: 950_000n, name: "Zúzottkő" });

  expect(JSON.parse(json)).toEqual({
    pricePerTonne: "950000",
    name: "Zúzottkő",
  });
});
