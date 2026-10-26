import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Mészkő-Polgár ERP/);
});

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(await response.json()).toEqual({ status: "ok" });
});
