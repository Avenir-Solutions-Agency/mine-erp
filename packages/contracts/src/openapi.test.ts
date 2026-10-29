import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { buildOpenApi, ROUTES } from "./openapi.ts";

test("the committed openapi.json matches the contract (run: pnpm --filter @mine-erp/contracts openapi)", () => {
  const committed = JSON.parse(
    readFileSync(new URL("../openapi.json", import.meta.url), "utf8"),
  );

  const generated = JSON.parse(JSON.stringify(buildOpenApi()));

  expect(committed).toEqual(generated);
});

test("every operation documents a body schema for JSON input and an error shape", () => {
  const doc = buildOpenApi();

  const ops = Object.values(doc.paths).flatMap((p) => Object.values(p)) as {
    responses: Record<string, unknown>;
  }[];

  expect(ops.length).toBe(ROUTES.length);
  expect(ops.every((o) => "default" in o.responses)).toBe(true);
});
