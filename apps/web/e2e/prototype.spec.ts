import { expect, test } from "@playwright/test";
import { NAV, ROUTE_IDS } from "../src/prototype/nav";

// Every demo screen renders on an empty database in the browser, without errors or horizontal page scroll (desktop and 375px).
test("every prototype screen renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/dash");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const route of ROUTE_IDS) {
    // Greyed-out screens have no nav link, so open every screen by URL.
    await page.goto(`/${route}`);
    await expect(page.locator("main h1:visible")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(overflow, `${route} scrolls horizontally`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("only enabled screens are links; the empty start has no badges", async ({
  page,
}) => {
  await page.goto("/transport");

  const enabled = NAV.flatMap((g) => g.items.filter((i) => i.enabled));
  await expect(page.locator("nav a")).toHaveCount(enabled.length);
  await expect(page.locator('nav [aria-disabled="true"]')).toHaveCount(
    ROUTE_IDS.length - enabled.length,
  );
  await expect(page.locator("nav a span.font-mono")).toHaveCount(0);
});
