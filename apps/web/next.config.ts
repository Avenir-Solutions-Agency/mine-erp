import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// One env file for the whole monorepo (the api reads it too); Next only looks in apps/web.
const rootEnv = new URL("../../.env.local", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
