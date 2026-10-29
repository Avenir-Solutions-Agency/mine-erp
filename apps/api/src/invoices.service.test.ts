import { describe, expect, test } from "vitest";
import { RateLimit } from "./auth.ts";
import { sniffType } from "./invoices.service.ts";

describe("sniffType", () => {
  test("recognises PDF, JPEG and PNG by their first bytes", () => {
    const files = [
      Buffer.from("%PDF-1.7\n"),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
    ];

    const types = files.map((f) => sniffType(f)?.ext);

    expect(types).toEqual(["pdf", "jpg", "png"]);
  });

  test("rejects a file that only claims to be a PDF", () => {
    const html = Buffer.from("<html>%PDF-</html>");

    const type = sniffType(html);

    expect(type).toBeNull();
  });
});

test("RateLimit rejects the request over the limit and resets after the window", () => {
  const limit = new RateLimit(2, 1000);

  limit.check("u", 0);
  limit.check("u", 10);

  expect(() => limit.check("u", 20)).toThrow();
  expect(() => limit.check("u", 2000)).not.toThrow();
});
