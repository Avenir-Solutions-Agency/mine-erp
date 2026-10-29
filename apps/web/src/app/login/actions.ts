"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hu } from "@/i18n/hu";
import { mfaSetup, mfaVerify, signIn, signOut } from "@/lib/session";

const Credentials = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export async function login(_: string | null, form: FormData) {
  const input = Credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success || !(await signIn(input.data.email, input.data.password)))
    return hu.login.failed;
  redirect("/login/mfa");
}

export async function logout() {
  await signOut();
  redirect("/login");
}

export async function loadMfa() {
  return mfaSetup();
}

const Code = z.object({
  factorId: z.string().min(1).max(100),
  code: z.string().regex(/^\d{6}$/),
});

export async function verifyMfa(_: string | null, form: FormData) {
  const input = Code.safeParse({
    factorId: form.get("factorId"),
    code: form.get("code"),
  });
  if (
    !input.success ||
    !(await mfaVerify(input.data.factorId, input.data.code))
  )
    return hu.login.mfaFailed;
  redirect("/scale");
}
