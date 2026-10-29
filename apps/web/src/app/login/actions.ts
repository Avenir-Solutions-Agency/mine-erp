"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hu } from "@/i18n/hu";
import { signIn, signOut } from "@/lib/session";

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
  redirect("/billing");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
