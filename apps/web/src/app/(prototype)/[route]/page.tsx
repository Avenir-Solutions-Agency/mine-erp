import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { hu } from "@/i18n/hu";
import { ROUTE_IDS, isRouteId } from "@/prototype/nav";

// Placeholder for every route not ported yet; a static folder per screen replaces it.
export function generateStaticParams() {
  return ROUTE_IDS.map((route) => ({ route }));
}

async function RoutePlaceholder({
  params,
}: Pick<PageProps<"/[route]">, "params">) {
  const { route } = await params;
  if (!isRouteId(route)) notFound();
  return (
    <div className="flex flex-col gap-4.5">
      <h1>{hu.nav.routes[route]}</h1>
      <EmptyState message={hu.placeholder} />
    </div>
  );
}

// Suspense keeps client navigation instant under Cache Components.
export default function RoutePlaceholderPage({
  params,
}: PageProps<"/[route]">) {
  return (
    <Suspense fallback={null}>
      <RoutePlaceholder params={params} />
    </Suspense>
  );
}
