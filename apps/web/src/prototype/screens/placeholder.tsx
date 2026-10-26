import { EmptyState } from "@/components/ui/empty-state";
import { hu } from "@/i18n/hu";
import type { RouteId } from "@/prototype/nav";

export function Placeholder({ route }: { route: RouteId }) {
  return (
    <div className="flex flex-col gap-4.5">
      <h1>{hu.nav.routes[route]}</h1>
      <EmptyState message={hu.placeholder} />
    </div>
  );
}
