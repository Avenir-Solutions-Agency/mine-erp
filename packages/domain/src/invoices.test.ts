import { describe, expect, test } from "vitest";
import {
  assignByHandwriting,
  fillerToString,
  invoiceStoragePath,
  toFiller,
} from "./invoices";

describe("money", () => {
  test("toFiller rounds forints to integer fillér", () => {
    const values = [12345, 99.999, -0.5, null];

    const filler = values.map(toFiller);

    expect(filler).toEqual([1234500n, 10000n, -50n, null]);
  });

  test("fillerToString keeps whole forints short and pads the decimals", () => {
    const values = [1234500n, 1234505n, -50n, null];

    const text = values.map(fillerToString);

    expect(text).toEqual(["12345", "12345.05", "-0.50", null]);
  });
});

test("invoiceStoragePath files by issue month and parks unknown dates", () => {
  const sha = "ab".repeat(32);

  const known = invoiceStoragePath("2026-10-22", sha, "pdf");
  const unknown = invoiceStoragePath(null, sha, "jpg");

  expect(known).toBe(`2026-10/${sha}.pdf`);
  expect(unknown).toBe(`datum-nelkul/${sha}.jpg`);
});

describe("assignByHandwriting", () => {
  const base = {
    issueDate: "2026-10-22",
    gross: 1000,
    carriers: ["UZT243", "ICW897", "ABC12", "ABC123"],
  };

  test("assigns when exactly one carrier is in the note, ignoring case and spaces", () => {
    const input = { ...base, handwriting: "uzt 243 Misi" };

    const result = assignByHandwriting(input);

    expect(result).toEqual({
      status: "assigned",
      costCarrier: "UZT243",
      warning: null,
    });
  });

  test("sends ambiguous notes to review with the candidates", () => {
    const input = { ...base, handwriting: "ABC-123" };

    const result = assignByHandwriting(input);

    expect(result.status).toBe("needs_review");
    expect(result.warning).toContain("ABC12, ABC123");
  });

  test("sends unreadable invoices to review even when the note matches", () => {
    const input = { ...base, handwriting: "ICW897", gross: null };

    const result = assignByHandwriting(input);

    expect(result).toEqual({
      status: "needs_review",
      costCarrier: null,
      warning: "Nem olvasható: bruttó összeg.",
    });
  });
});
