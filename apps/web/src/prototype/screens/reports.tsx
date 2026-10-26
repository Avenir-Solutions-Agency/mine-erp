"use client";

import type { ComponentType } from "react";
import { useDemo } from "@/prototype/store";
import { Head, TabBar } from "@/prototype/ui";
import {
  CashTab,
  CostTab,
  CustTab,
  LaborTab,
  MachTab,
  MbTab,
  PlanTab,
  PnlTab,
  SimTab,
} from "./reports-parts";

// V.reports (round 2) with the round-5 "Anyagmérleg" tab after "Terv–tény".
const TABS: [string, string][] = [
  ["pnl", "Eredmény"],
  ["plan", "Terv–tény"],
  ["mb", "Anyagmérleg"],
  ["cash", "Cash-flow"],
  ["cost", "Önköltség és árazás"],
  ["sim", "Mi lenne, ha"],
  ["cust", "Vevők"],
  ["labor", "Munkaerő"],
  ["mach", "Gépköltség"],
];

const R: Record<string, ComponentType> = {
  pnl: PnlTab,
  plan: PlanTab,
  mb: MbTab,
  cash: CashTab,
  cost: CostTab,
  sim: SimTab,
  cust: CustTab,
  labor: LaborTab,
  mach: MachTab,
};

export function ReportsScreen() {
  const { ui, actions } = useDemo();
  const tab = ui.sub.reports;
  const Tab = R[tab];
  return (
    <>
      <Head
        title="Riportok és árazás"
        sub="Minden riport ugyanabból a költségmodellből: amit itt lát, azzal számol az árazó is."
      />
      <TabBar
        items={TABS}
        active={tab}
        onSelect={(k) => actions.openReport(k)}
      />
      {Tab ? <Tab /> : null}
    </>
  );
}
