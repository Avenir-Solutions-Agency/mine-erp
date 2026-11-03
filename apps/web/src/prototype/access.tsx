"use client";

import type { MeDto, MenuAccess, MenuId } from "@mine-erp/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { hu } from "@/i18n/hu";
import { ApiFailure, api } from "@/prototype/api";
import { isRouteId } from "@/prototype/nav";
import { Alert } from "@/prototype/ui";

// The signed-in user's menus (GET /me). The API refuses everything else on its own; this only
// hides what the user cannot open.

type AccessState =
  | { kind: "loading" }
  | { kind: "ok"; me: MeDto }
  | { kind: "login" }
  | { kind: "error"; message: string };

const AccessContext = createContext<AccessState>({ kind: "loading" });

export function AccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    api<MeDto>("me")
      .then((me) => live && setState({ kind: "ok", me }))
      .catch(
        (e: unknown) =>
          live &&
          setState(
            e instanceof ApiFailure && e.status === 401
              ? { kind: "login" }
              : { kind: "error", message: (e as Error).message },
          ),
      );
    return () => {
      live = false;
    };
  }, []);
  return <AccessContext value={state}>{children}</AccessContext>;
}

/** Menu access once known; empty while loading or signed out. */
export function useMenuAccess(): MenuAccess {
  const state = use(AccessContext);
  return state.kind === "ok" ? state.me.access : {};
}

export function useCanWrite(menu: MenuId): boolean {
  return useMenuAccess()[menu] === "write";
}

export function useMe(): MeDto | null {
  const state = use(AccessContext);
  return state.kind === "ok" ? state.me : null;
}

/** Shows the screen only for a menu the user has; otherwise why not. */
export function AccessGate({ children }: { children: ReactNode }) {
  const state = use(AccessContext);
  const route = usePathname().slice(1);
  if (state.kind === "loading")
    return <p className="text-sm text-muted-foreground">{hu.loading}</p>;
  if (state.kind === "login")
    return (
      <Alert lvl="warn">
        {hu.access.loginBefore}{" "}
        <Link href="/login" className="font-semibold underline">
          {hu.access.loginLink}
        </Link>
        .
      </Alert>
    );
  if (state.kind === "error") return <Alert lvl="bad">{state.message}</Alert>;
  if (isRouteId(route) && !state.me.access[route])
    return <Alert lvl="warn">{hu.access.noMenu}</Alert>;
  return children;
}
