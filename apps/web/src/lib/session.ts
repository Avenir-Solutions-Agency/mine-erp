import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

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
