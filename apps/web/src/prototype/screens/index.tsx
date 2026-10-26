"use client";

import type { ComponentType } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { hu } from "@/i18n/hu";
import type { RouteId } from "@/prototype/nav";
import { useDemo } from "@/prototype/store";
import { DashScreen } from "./dash";

// Ported screens, one per demo view (V.*). Routes not listed yet show the placeholder.
const SCREENS: Partial<Record<RouteId, ComponentType>> = {
  dash: DashScreen,
};

export function Screen({ route }: { route: RouteId }) {
  const demo = useDemo();
  const View = SCREENS[route];
  // Remount on every engine render, as the demo rebuilds the view's HTML: unbound inputs reset.
  if (View) return <View key={demo.version} />;
  return (
    <div className="flex flex-col gap-4.5">
      <h1>{hu.nav.routes[route]}</h1>
      <EmptyState message={hu.placeholder} />
    </div>
  );
}
