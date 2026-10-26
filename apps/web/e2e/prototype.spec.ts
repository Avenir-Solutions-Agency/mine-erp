import { expect, test } from "@playwright/test";
import { ROUTE_IDS } from "../src/prototype/nav";

// Every demo screen renders in the browser, without errors or horizontal page scroll (desktop and 375px).
test("every prototype screen renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/dash");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const route of ROUTE_IDS) {
    await page.locator(`nav a[href="/${route}"]`).click();
    await page.waitForURL(`**/${route}`);
    // Next keeps recent routes mounted but hidden (Activity), so look at the visible heading only.
    await expect(page.locator("main h1:visible")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(overflow, `${route} scrolls horizontally`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("nav badges match the original demo after bootstrap", async ({ page }) => {
  await page.goto("/dash");

  const badges = page.locator('nav a[href="/ai"] span').last();

  await expect(badges).toHaveText("7");
  await expect(page.locator('nav a[href="/dispatch"] span').last()).toHaveText(
    "43",
  );
});
