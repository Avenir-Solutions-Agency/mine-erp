import { z } from "zod";

/** NAV's production host. Never called from development, tests or scripts (AGENTS.md §03). */
export const PRODUCTION_HOST = "import.ekaer.nav.gov.hu";

const Env = z.object({
  // No default on purpose (decided 2026-10-29): a missing value must fail, not fall back to a host.
  EKAER_BASE_URL: z.url(),
  // Pattern from the XSD (UserNameType): no underscore.
  EKAER_USER: z.string().regex(/^[a-zA-Z0-9\-@.]{6,30}$/),
  EKAER_PASSWORD: z.string().min(1),
  EKAER_SIGNING_KEY: z.string().min(6).max(15),
  EKAER_TAX_NUMBER: z.string().regex(/^\d{8}$/),
  NODE_ENV: z.string().optional(),
});

export interface EkaerConfig {
  /** e.g. https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer */
  baseUrl: string;
  user: string;
  password: string;
  signingKey: string;
  /** First 8 digits of the company's tax number. */
  vatNumber: string;
}

/**
 * Reads the EKÁER settings and refuses anything but HTTPS, and the production host unless the
 * process itself runs in production. Error messages name the variables, never their values.
 */
export function loadEkaerConfig(
  env: Record<string, string | undefined> = process.env,
): EkaerConfig {
  const parsed = Env.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid EKÁER configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const e = parsed.data;
  const url = new URL(e.EKAER_BASE_URL);
  if (url.protocol !== "https:")
    throw new Error("EKAER_BASE_URL must use https");
  if (url.hostname === PRODUCTION_HOST && e.NODE_ENV !== "production")
    throw new Error(
      "EKAER_BASE_URL points at NAV production outside a production deployment",
    );
  return {
    baseUrl: e.EKAER_BASE_URL.replace(/\/+$/, ""),
    user: e.EKAER_USER,
    password: e.EKAER_PASSWORD,
    signingKey: e.EKAER_SIGNING_KEY,
    vatNumber: e.EKAER_TAX_NUMBER,
  };
}
