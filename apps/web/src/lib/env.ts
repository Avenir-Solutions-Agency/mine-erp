import "server-only";
import { z } from "zod";

// Server-only environment, validated once at import. Names: docs/ARCHITECTURE.md §09.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_BASE_URL: z.url().optional(),
});

export const env = envSchema.parse(process.env);
