import { describe, expect, test } from "vitest";
import {
  fillerToString,
  invoiceStoragePath,
  missingFieldsWarning,
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

test("missingFieldsWarning names the unreadable key fields", () => {
  const readable = { issueDate: "2026-10-24", gross: 70277 };
  const unreadable = { issueDate: null, gross: null };

  const ok = missingFieldsWarning(readable);
  const bad = missingFieldsWarning(unreadable);

  expect(ok).toBeNull();
  expect(bad).toBe("Nem olvasható: kelte, bruttó összeg.");
});
