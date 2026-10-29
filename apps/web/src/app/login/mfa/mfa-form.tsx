"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hu } from "@/i18n/hu";
import type { MfaSetup } from "@/lib/session";
import { loadMfa, verifyMfa } from "../actions";

export function MfaForm() {
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [error, action, pending] = useActionState(verifyMfa, null);
  useEffect(() => {
    let live = true;
    void loadMfa().then((s) => live && setSetup(s));
    return () => {
      live = false;
    };
  }, []);

  if (!setup)
    return <p className="text-muted-foreground">{hu.login.mfaLoading}</p>;
  if (setup.state === "signed_out")
    return (
      <p>
        <Link href="/login" className="font-semibold underline">
          {hu.login.title}
        </Link>
      </p>
    );
  return (
    <form action={action} className="grid gap-3">
      {setup.state === "enroll" ? (
        <>
          <p className="text-sm">{hu.login.mfaEnroll}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
          <img
            src={setup.qrCode}
            alt="QR-kód a hitelesítő alkalmazáshoz"
            className="mx-auto size-48 rounded-lg bg-white p-2"
          />
          <p className="text-xs text-muted-foreground">
            {hu.login.mfaSecret}{" "}
            <code className="font-mono break-all">{setup.secret}</code>
          </p>
        </>
      ) : (
        <p className="text-sm">{hu.login.mfaVerify}</p>
      )}
      <input type="hidden" name="factorId" value={setup.factorId} />
      <div className="grid gap-1.5">
        <Label htmlFor="code">{hu.login.mfaCode}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? hu.login.pending : hu.login.mfaSubmit}
      </Button>
    </form>
  );
}
