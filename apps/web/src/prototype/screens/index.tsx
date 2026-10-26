"use client";

import type { ComponentType } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { hu } from "@/i18n/hu";
import type { RouteId } from "@/prototype/nav";

// Ported screens, one per demo view (V.*). Routes not listed yet show the placeholder.
const SCREENS: Partial<Record<RouteId, ComponentType>> = {};

export function Screen({ route }: { route: RouteId }) {
  const View = SCREENS[route];
  if (View) return <View />;
  return (
    <div className="flex flex-col gap-4.5">
      <h1>{hu.nav.routes[route]}</h1>
      <EmptyState message={hu.placeholder} />
    </div>
  );
}
