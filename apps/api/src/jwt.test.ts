import { generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import { jwksCache, tokenKid, verifySupabaseJwt } from "./jwt.ts";

const ISS = "https://example.supabase.co/auth/v1";
const expected = { issuer: ISS, audience: "authenticated" };
const now = 1_800_000_000;

const pair = () => generateKeyPairSync("ec", { namedCurve: "P-256" });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function jwt(
  privateKey: KeyObject,
  claims: object,
  header: object = { alg: "ES256", kid: "k1" },
) {
  const data = `${b64(header)}.${b64(claims)}`;
  const sig = sign("sha256", Buffer.from(data), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${sig.toString("base64url")}`;
}

const good = {
  sub: "u1",
  email: "a@b.hu",
  aal: "aal2",
  exp: now + 600,
  iss: ISS,
  aud: "authenticated",
};

describe("verifySupabaseJwt", () => {
  const { privateKey, publicKey } = pair();
  const keys = new Map([["k1", publicKey]]);

  test("accepts a token signed by the project key and returns its claims", () => {
    const token = jwt(privateKey, good);

    const r = verifySupabaseJwt(token, keys, expected, now);

    expect(r).toEqual({ ok: true, claims: good });
  });

  test("rejects a foreign signature, an unknown key, expiry, issuer and audience", () => {
    const other = pair().privateKey;
    const cases = [
      jwt(other, good),
      jwt(privateKey, good, { alg: "ES256", kid: "k2" }),
      jwt(privateKey, { ...good, exp: now - 60 }),
      jwt(privateKey, { ...good, iss: "https://evil.example/auth/v1" }),
      jwt(privateKey, { ...good, aud: "anon" }),
    ];

    const errors = cases.map((t) => {
      const r = verifySupabaseJwt(t, keys, expected, now);
      return r.ok ? "ok" : r.error;
    });

    expect(errors).toEqual([
      "bad_signature",
      "unknown_key",
      "expired",
      "wrong_issuer",
      "wrong_audience",
    ]);
  });

  test("refuses alg none and HS256 even with a known kid", () => {
    const unsigned = `${b64({ alg: "none", kid: "k1" })}.${b64(good)}.`;
    const hs = `${b64({ alg: "HS256", kid: "k1" })}.${b64(good)}.c2lnbmF0dXJl`;

    const results = [
      verifySupabaseJwt(unsigned, keys, expected, now),
      verifySupabaseJwt(hs, keys, expected, now),
    ];

    expect(results.map((r) => (r.ok ? "ok" : r.error))).toEqual([
      "bad_signature",
      "bad_signature",
    ]);
  });

  test("reports a token that is not a JWT as malformed", () => {
    const r = verifySupabaseJwt("not-a-jwt", keys, expected, now);

    expect(r).toEqual({ ok: false, error: "malformed" });
  });
});

test("jwksCache loads the project's keys and tokenKid reads the header", async () => {
  const { privateKey, publicKey } = pair();
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "k1",
    alg: "ES256",
    use: "sig",
  };
  let calls = 0;
  const get = jwksCache("https://example/jwks", async () => {
    calls++;
    return { keys: [jwk] };
  });
  const token = jwt(privateKey, good);

  const keys = await get(tokenKid(token));
  await get(tokenKid(token));

  expect(calls).toBe(1);
  expect(verifySupabaseJwt(token, keys, expected, now).ok).toBe(true);
});
