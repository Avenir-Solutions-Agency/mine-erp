import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { svgDataUrl } from "@/lib/svg-data-url";

// Supabase Auth tokens live in httpOnly cookies, so browser JavaScript never sees them.
const ACCESS = "erp_at";
const REFRESH = "erp_rt";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function tokenRequest(grant: "password" | "refresh_token", body: object) {
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("Supabase is not configured");
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=${grant}`,
    {
      method: "POST",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  return res.ok ? ((await res.json()) as TokenResponse) : null;
}

async function store(t: TokenResponse) {
  const jar = await cookies();
  const base = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  jar.set(ACCESS, t.access_token, { ...base, maxAge: t.expires_in });
  jar.set(REFRESH, t.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 7 });
}

/** True when Supabase accepted the email and password. */
export async function signIn(email: string, password: string) {
  const t = await tokenRequest("password", { email, password });
  if (t) await store(t);
  return t !== null;
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

/** A valid access token, refreshed when the short-lived one expired; null means sign in again. */
export async function accessToken(): Promise<string | null> {
  const jar = await cookies();
  const at = jar.get(ACCESS)?.value;
  if (at) return at;
  const rt = jar.get(REFRESH)?.value;
  if (!rt) return null;
  const t = await tokenRequest("refresh_token", { refresh_token: rt });
  if (!t) return null;
  await store(t);
  return t.access_token;
}

/** Calls Supabase Auth as the signed-in user (MFA endpoints). */
async function asUser(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  if (
    !token ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  return fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
}

type Factor = { id: string; factor_type: string; status: string };

export type MfaSetup =
  | { state: "signed_out" }
  | { state: "verify"; factorId: string }
  | { state: "enroll"; factorId: string; qrCode: string; secret: string };

/**
 * The TOTP step after the password (SECURITY.md: office users need aal2). A user with a verified
 * authenticator only types the code; anyone else gets a fresh QR code (unfinished enrolments are
 * removed first, as Supabase keeps them).
 */
export async function mfaSetup(): Promise<MfaSetup> {
  const me = await asUser("user");
  if (!me?.ok) return { state: "signed_out" };
  const factors = ((await me.json()) as { factors?: Factor[] }).factors ?? [];
  const verified = factors.find(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );
  if (verified) return { state: "verify", factorId: verified.id };
  for (const f of factors.filter((f) => f.status !== "verified"))
    await asUser(`factors/${f.id}`, { method: "DELETE" });
  const res = await asUser("factors", {
    method: "POST",
    body: JSON.stringify({
      factor_type: "totp",
      friendly_name: `ERP ${new Date().toISOString()}`,
    }),
  });
  if (!res?.ok) return { state: "signed_out" };
  const f = (await res.json()) as {
    id: string;
    totp: { qr_code: string; secret: string };
  };
  return {
    state: "enroll",
    factorId: f.id,
    qrCode: svgDataUrl(f.totp.qr_code),
    secret: f.totp.secret,
  };
}

/** Checks the 6-digit code; on success Supabase returns an aal2 session, which replaces the cookies. */
export async function mfaVerify(
  factorId: string,
  code: string,
): Promise<boolean> {
  const challenge = await asUser(`factors/${factorId}/challenge`, {
    method: "POST",
  });
  if (!challenge?.ok) return false;
  const { id } = (await challenge.json()) as { id: string };
  const res = await asUser(`factors/${factorId}/verify`, {
    method: "POST",
    body: JSON.stringify({ challenge_id: id, code }),
  });
  if (!res?.ok) return false;
  await store((await res.json()) as TokenResponse);
  return true;
}
