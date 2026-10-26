import { defineConfig } from "vitest/config";

// The demo engine formats and compares local dates; pin the zone so CI (UTC) matches the golden snapshot.
process.env.TZ = "Europe/Budapest";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
