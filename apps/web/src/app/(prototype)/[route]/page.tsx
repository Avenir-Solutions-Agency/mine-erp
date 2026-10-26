import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ROUTE_IDS, isRouteId } from "@/prototype/nav";
import { Screen } from "@/prototype/screens";

// Screens render only in the browser, where the demo engine lives; there is no server UI to make instant.
export const instant = false;

export function generateStaticParams() {
  return ROUTE_IDS.map((route) => ({ route }));
}

async function RouteScreen({ params }: Pick<PageProps<"/[route]">, "params">) {
  const { route } = await params;
  if (!isRouteId(route)) notFound();
  return <Screen route={route} />;
}

export default function RoutePage({ params }: PageProps<"/[route]">) {
  return (
    <Suspense fallback={null}>
      <RouteScreen params={params} />
    </Suspense>
  );
}
