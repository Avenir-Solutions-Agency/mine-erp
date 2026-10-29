import { createPublicKey, type KeyObject, verify } from "node:crypto";

// Supabase access tokens verified locally against the project's JWKS (T-005), with Node's own
// crypto. Only asymmetric algorithms: "none" and HS* are refused.

export interface SupabaseClaims {
  sub: string;
  email?: string;
  /** "aal1" after the password, "aal2" after the TOTP code. */
  aal?: string;
  exp: number;
  iss: string;
  aud: string | string[];
}

export type JwtError =
  | "malformed"
  | "unknown_key"
  | "bad_signature"
  | "expired"
  | "wrong_issuer"
  | "wrong_audience";

const json = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;

/** Checks signature, expiry (30 s clock skew), issuer and audience; returns the claims or why not. */
export function verifySupabaseJwt(
  token: string,
  keys: Map<string, KeyObject>,
  expected: { issuer: string; audience: string },
  nowSec = Math.floor(Date.now() / 1000),
): { ok: true; claims: SupabaseClaims } | { ok: false; error: JwtError } {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "malformed" };
  const [h, p, s] = parts as [string, string, string];
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = json(h);
    claims = json(p);
  } catch {
    return { ok: false, error: "malformed" };
  }
  const key = typeof header.kid === "string" ? keys.get(header.kid) : undefined;
  if (!key) return { ok: false, error: "unknown_key" };
  const data = Buffer.from(`${h}.${p}`);
  const sig = Buffer.from(s, "base64url");
  const valid =
    header.alg === "ES256"
      ? verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig)
      : header.alg === "RS256"
        ? verify("sha256", data, key, sig)
        : false;
  if (!valid) return { ok: false, error: "bad_signature" };
  if (typeof claims.exp !== "number" || claims.exp + 30 < nowSec)
    return { ok: false, error: "expired" };
  if (claims.iss !== expected.issuer)
    return { ok: false, error: "wrong_issuer" };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.audience))
    return { ok: false, error: "wrong_audience" };
  if (typeof claims.sub !== "string") return { ok: false, error: "malformed" };
  return { ok: true, claims: claims as unknown as SupabaseClaims };
}

/** The project's signing keys, refreshed every 10 minutes and at most once a minute on an unknown kid (key rotation). */
export function jwksCache(
  url: string,
  fetchJson: (u: string) => Promise<unknown> = (u) =>
    fetch(u).then((r) => r.json()),
) {
  let keys = new Map<string, KeyObject>();
  let loadedAt = 0;
  async function load() {
    const body = (await fetchJson(url)) as {
      keys?: (Record<string, unknown> & { kid?: string })[];
    };
    keys = new Map(
      (body.keys ?? [])
        .filter((k) => typeof k.kid === "string")
        .map((k) => [k.kid!, createPublicKey({ key: k, format: "jwk" })]),
    );
    loadedAt = Date.now();
  }
  return async function get(
    kid: string | undefined,
  ): Promise<Map<string, KeyObject>> {
    const age = Date.now() - loadedAt;
    if (age > 10 * 60_000 || (kid && !keys.has(kid) && age > 60_000))
      await load();
    return keys;
  };
}

/** The kid of a token without verifying it, to pick the key. */
export function tokenKid(token: string): string | undefined {
  try {
    const kid = json(token.split(".")[0] ?? "").kid;
    return typeof kid === "string" ? kid : undefined;
  } catch {
    return undefined;
  }
}
