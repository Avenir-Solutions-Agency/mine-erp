import { expect, test } from "vitest";
import { svgDataUrl } from "./svg-data-url";

test("re-encodes Supabase's raw SVG data URL so browsers render it", () => {
  const raw =
    'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>';

  const url = svgDataUrl(raw);

  expect(url.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
  expect(url).toContain("%23000");
  expect(decodeURIComponent(url.split(",")[1]!)).toBe(
    raw.split(",").slice(1).join(","),
  );
});

test("leaves an already encoded data URL alone", () => {
  const encoded = "data:image/png;base64,iVBORw0KGgo=";

  expect(svgDataUrl(encoded)).toBe(encoded);
});
