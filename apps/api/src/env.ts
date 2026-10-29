import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  // ARCHITECTURE §06: the AI model id is configuration, not code.
  OPENAI_MODEL: z.string().min(1),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  INVOICE_BUCKET: z.string().default("invoices"),
  GOTENBERG_URL: z.url().default("http://localhost:3001"),
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  // "false" lets a password-only session in (local development before TOTP is set up). Never in production.
  AUTH_REQUIRE_AAL2: z.enum(["true", "false"]).default("true"),
  // Development only: enables DELETE /invoices (wipes every invoice). Never set in production.
  ALLOW_DATA_RESET: z.enum(["true", "false"]).default("false"),
  // Shared secret of the local scale agent; without it the API refuses scale readings.
  SCALE_AGENT_TOKEN: z.string().min(32).optional(),
});
export type Env = z.infer<typeof Env>;

/** Fails fast at boot with the names of the missing variables, never their values. */
export function loadEnv(): Env {
  // Empty lines in .env files mean "not set", so defaults apply.
  const parsed = Env.safeParse(
    Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
  );
  if (!parsed.success)
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  return parsed.data;
}

export const ENV = Symbol("ENV");
