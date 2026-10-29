import "reflect-metadata";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { ROUTES } from "@mine-erp/contracts/openapi";
import { expect, test } from "vitest";
import { EkaerReportsController } from "./ekaer-reports.ts";
import { HealthController } from "./health.ts";
import { InvoicesController } from "./invoices.controller.ts";
import { MasterDataController } from "./master-data.ts";
import { ScaleController } from "./scale.ts";
import { WeighingsController } from "./weighings.controller.ts";

const CONTROLLERS = [
  HealthController,
  InvoicesController,
  MasterDataController,
  ScaleController,
  WeighingsController,
  EkaerReportsController,
];

/** "METHOD /path" for every route Nest would map, read from the decorators. */
function nestRoutes(): string[] {
  const join = (...parts: string[]) =>
    `/${parts.filter(Boolean).join("/")}`
      .replace(/\/+/g, "/")
      .replace(/\/$/, "") || "/";
  return CONTROLLERS.flatMap((c) => {
    const base = String(Reflect.getMetadata(PATH_METADATA, c) ?? "");
    return Object.getOwnPropertyNames(c.prototype)
      .filter((name) => name !== "constructor")
      .map((name) => (c.prototype as Record<string, unknown>)[name])
      .filter(
        (h): h is object =>
          typeof h === "function" && Reflect.hasMetadata(PATH_METADATA, h),
      )
      .map((h) => {
        const method =
          RequestMethod[Reflect.getMetadata(METHOD_METADATA, h) as number]!;
        return `${method} ${join(base, String(Reflect.getMetadata(PATH_METADATA, h)))}`;
      });
  });
}

test("the OpenAPI contract lists exactly the API's routes", () => {
  const documented = ROUTES.map(
    (r) => `${r.method.toUpperCase()} ${r.path}`,
  ).sort();

  const implemented = nestRoutes().sort();

  expect(implemented).toEqual(documented);
});
