import "reflect-metadata";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { expect, test } from "vitest";
import { Access, AuthGuard, hasAccess, read, write } from "./auth.ts";
import { CONTROLLERS } from "./openapi.test.ts";

test("write includes read; read does not allow write; any listed menu is enough", () => {
  expect(hasAccess({ scale: "write" }, read("scale"))).toBe(true);
  expect(hasAccess({ scale: "read" }, read("scale"))).toBe(true);
  expect(hasAccess({ scale: "read" }, write("scale"))).toBe(false);
  expect(hasAccess({ dn: "read" }, read("transport", "dn"))).toBe(true);
  expect(hasAccess({ billing: "write" }, read("scale"))).toBe(false);
  expect(hasAccess({}, read("scale"))).toBe(false);
  expect(hasAccess({}, read())).toBe(true);
});

test("every route behind AuthGuard names its menu, so none is open by accident", () => {
  const reflector = new Reflector();
  const missing = CONTROLLERS.flatMap((c) => {
    const guards = (Reflect.getMetadata("__guards__", c) ?? []) as unknown[];
    return Object.getOwnPropertyNames(c.prototype)
      .filter((name) => name !== "constructor")
      .map((name) => (c.prototype as Record<string, unknown>)[name])
      .filter(
        (h): h is (...a: unknown[]) => unknown =>
          typeof h === "function" && Reflect.hasMetadata(PATH_METADATA, h),
      )
      .filter((h) => {
        const guarded = [
          ...guards,
          ...((Reflect.getMetadata("__guards__", h) ?? []) as unknown[]),
        ].includes(AuthGuard);
        return guarded && !reflector.get(Access, h);
      })
      .map((h) => `${c.name}.${h.name}`);
  });
  expect(missing).toEqual([]);
});
