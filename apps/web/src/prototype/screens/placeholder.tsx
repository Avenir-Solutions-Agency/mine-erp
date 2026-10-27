import { EmptyState } from "@/components/ui/empty-state";
import { hu } from "@/i18n/hu";
import type { RouteId } from "@/prototype/nav";

export function Placeholder({
  route,
  message = hu.placeholder,
}: {
  route: RouteId;
  message?: string;
}) {
  return (
    <div className="flex flex-col gap-4.5">
      <h1>{hu.nav.routes[route]}</h1>
      <EmptyState message={message} />
    </div>
  );
}
