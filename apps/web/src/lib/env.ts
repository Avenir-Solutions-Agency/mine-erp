import "server-only";
import { z } from "zod";

// Server-only environment, validated once at import. Names: docs/ARCHITECTURE.md §09.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_BASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

// Empty lines in .env files ("API_BASE_URL=") mean "not set", not an invalid value.
export const env = envSchema.parse(
  Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
);
