import { hu } from "@/i18n/hu";

export type RouteId = keyof typeof hu.nav.routes;
export type GroupId = keyof typeof hu.nav.groups;
/** Badge counters; formulas live with the store (docs/demo-inventory part 4, "Navigation, counts"). */
export type CounterKey =
  "ap" | "inq" | "con" | "pend" | "ek" | "tig" | "jobs" | "mlog";

type NavItem = { id: RouteId; counter?: CounterKey };

// Final navigation of the demo after all its patches (docs/demo-inventory/README.md).
export const NAV: readonly { group: GroupId; items: readonly NavItem[] }[] = [
  {
    group: "overview",
    items: [{ id: "dash" }, { id: "today" }, { id: "ai", counter: "ap" }],
  },
  {
    group: "sales",
    items: [
      { id: "inbox", counter: "inq" },
      { id: "quotes" },
      { id: "contracts", counter: "con" },
      { id: "orders" },
      { id: "portal" },
    ],
  },
  {
    group: "logistics",
    items: [
      { id: "dispatch", counter: "pend" },
      { id: "transport", counter: "ek" },
      { id: "scale" },
      { id: "driverapp" },
      { id: "telem" },
      { id: "dn" },
      { id: "tig", counter: "tig" },
      { id: "billing" },
      { id: "integr", counter: "jobs" },
    ],
  },
  {
    group: "plant",
    items: [
      { id: "stock" },
      { id: "store" },
      { id: "qr" },
      { id: "operapp" },
      { id: "mechapp", counter: "mlog" },
      { id: "waste" },
      { id: "machines" },
    ],
  },
  { group: "finance", items: [{ id: "reports" }, { id: "payroll" }] },
  { group: "project", items: [{ id: "plan" }] },
];

export const ROUTE_IDS: readonly RouteId[] = NAV.flatMap((g) =>
  g.items.map((i) => i.id),
);

export function isRouteId(value: string): value is RouteId {
  return (ROUTE_IDS as readonly string[]).includes(value);
}
