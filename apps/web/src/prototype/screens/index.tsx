"use client";

import type { ComponentType } from "react";
import type { RouteId } from "@/prototype/nav";
import { useDemo } from "@/prototype/store";
import { DashScreen } from "./dash";
import { TodayScreen } from "./today";
import { AiScreen } from "./ai";
import { InboxScreen } from "./inbox";
import { QuotesScreen } from "./quotes";
import { ContractsScreen } from "./contracts";
import { OrdersScreen } from "./orders";
import { PortalScreen } from "./portal";
import { DispatchScreen } from "./dispatch";
import { TransportScreen } from "./transport";
import { ScaleScreen } from "./scale";
import { DriverAppScreen } from "./driverapp";
import { TelemScreen } from "./telem";
import { DnScreen } from "./dn";
import { TigScreen } from "./tig";
import { BillingScreen } from "./billing";
import { IntegrScreen } from "./integr";
import { StockScreen } from "./stock";
import { StoreScreen } from "./store";
import { QrScreen } from "./qr";
import { OperAppScreen } from "./operapp";
import { MechAppScreen } from "./mechapp";
import { WasteScreen } from "./waste";
import { MachinesScreen } from "./machines";
import { ReportsScreen } from "./reports";
import { PayrollScreen } from "./payroll";
import { PlanScreen } from "./plan";

// One screen per demo view (V.*), in its final, patched form.
const SCREENS: Record<RouteId, ComponentType> = {
  dash: DashScreen,
  today: TodayScreen,
  ai: AiScreen,
  inbox: InboxScreen,
  quotes: QuotesScreen,
  contracts: ContractsScreen,
  orders: OrdersScreen,
  portal: PortalScreen,
  dispatch: DispatchScreen,
  transport: TransportScreen,
  scale: ScaleScreen,
  driverapp: DriverAppScreen,
  telem: TelemScreen,
  dn: DnScreen,
  tig: TigScreen,
  billing: BillingScreen,
  integr: IntegrScreen,
  stock: StockScreen,
  store: StoreScreen,
  qr: QrScreen,
  operapp: OperAppScreen,
  mechapp: MechAppScreen,
  waste: WasteScreen,
  machines: MachinesScreen,
  reports: ReportsScreen,
  payroll: PayrollScreen,
  plan: PlanScreen,
};

export function Screen({ route }: { route: RouteId }) {
  const demo = useDemo();
  const View = SCREENS[route];
  // Remount on every engine render, as the demo rebuilds the view's HTML: unbound inputs reset.
  return <View key={demo.version} />;
}
