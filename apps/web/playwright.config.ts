import { defineConfig, devices } from "@playwright/test";

// Own port, so e2e never reuses another app's dev server on :3000.
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    // Production build: Next 16 allows only one `next dev` per project directory.
    command: "pnpm build && pnpm start --port 3100",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
  },
});
