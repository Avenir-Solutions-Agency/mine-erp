import { expect, test } from "vitest";
import { RegisterDocumentInput } from "./index.ts";

const ok = {
  paperTicketNumber: "MJ-2026-003277",
  weighedAt: "2026-10-26T07:49:00.000Z",
  plate: "TBJ586",
  trailerPlate: "XUN434",
  customerId: "0193f0a0-0000-7000-8000-000000000001",
  productId: "0193f0a0-0000-7000-8000-000000000002",
  grossKg: 41_860,
  tareKg: 14_880,
  loadingAddress: "8000 Székesfehérvár, 020195/3 hrsz.",
  unloadingAddress: "2063 Óbarok, 47.495861, 18.561926",
  deliveryNoteNumber: "Cs 0096867",
  ekaerNumber: "E2610267233595",
  ekaerValueHuf: null,
};

test("accepts a reviewed paper ticket", () => {
  const input = ok;

  const result = RegisterDocumentInput.safeParse(input);

  expect(result.success).toBe(true);
});

test("refuses a tare that is not below the gross weight", () => {
  const input = { ...ok, tareKg: 41_860 };

  const result = RegisterDocumentInput.safeParse(input);

  expect(result.error?.issues[0]?.message).toBe(
    "A bruttó legyen nagyobb a táránál.",
  );
});
