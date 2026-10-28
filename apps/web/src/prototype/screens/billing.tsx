"use client";

import { useDemo } from "@/prototype/store";
import { Head, TabBar } from "@/prototype/ui";
import { ArTab, OutTab, QueueTab, SettingsTab } from "./billing-parts";
import { InboundTab } from "./billing-inbound";

const TABS: [string, string][] = [
  ["out", "Kimenő számlák"],
  ["queue", "Számlázási sor"],
  ["ar", "Kintlévőség, behajtás"],
  ["in", "Bejövő számlák"],
  ["set", "Beállítások"],
];

// Final V.billing: the round-4 tabs, `ar` = the round-2 ageing part, `in` = the boss's invoice portal.
export function BillingScreen() {
  const { actions, view } = useDemo();
  const tab = view.INVF.tab;
  return (
    <>
      <Head
        title="Számlák"
        sub="Kimenő és bejövő számlák, számlázási sor, kintlévőség és behajtás egy helyen. A kimenő számla a Billingón keresztül készül, csak elfogadott TIG-ből."
      />
      <TabBar
        items={TABS}
        active={tab}
        onSelect={(k) => actions.setInvTab(k)}
      />
      {tab === "out" ? <OutTab /> : null}
      {tab === "queue" ? <QueueTab /> : null}
      {tab === "ar" ? <ArTab /> : null}
      {tab === "in" ? <InboundTab /> : null}
      {tab === "set" ? <SettingsTab /> : null}
    </>
  );
}
