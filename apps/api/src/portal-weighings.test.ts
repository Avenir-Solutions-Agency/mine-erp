import type { PortalWeighingInput } from "@mine-erp/contracts";
import { expect, test } from "vitest";
import { samePortalWeighing } from "./portal-weighings.ts";

const row: PortalWeighingInput = {
  portalId: 7,
  ticketNumber: "2026/000123",
  direction: "outbound",
  status: "completed",
  licensePlate: "ABC-123",
  trailerPlate: null,
  customerName: "Vevő Kft.",
  customerTaxNumber: "12345678-2-13",
  materialName: "0/56 zúzottkő",
  grossKg: 38_520,
  tareKg: 14_180,
  netKg: 24_340,
  firstWeightKg: 14_180,
  firstMeasuredAt: "2026-11-03T09:01:00.000Z",
  completedAt: "2026-11-03T09:20:00.000Z",
  driverName: "Kovács János",
  carrierName: null,
  ekaerNumber: null,
};

test("a resent row with the same instant in another offset is not a change", () => {
  const resent = { ...row, completedAt: "2026-11-03T10:20:00+01:00" };

  const same = samePortalWeighing(row, resent);

  expect(same).toBe(true);
});

test("a second weight or a new status is a change", () => {
  const closed = { ...row, status: "open" as const, netKg: null };

  const same = samePortalWeighing(closed, row);

  expect(same).toBe(false);
});
