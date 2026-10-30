"use client";

import type { PolicyDto } from "@mine-erp/contracts";
import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { api } from "@/prototype/api";
import { Alert, Btn, Panel, Small } from "@/prototype/ui";

// Szabályok (T-020): the automatic EKÁER switch and what it needs before it acts.

export function TransportRules() {
  const [policy, setPolicy] = useState<PolicyDto | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<PolicyDto>("policy")
      .then((p) => live && setPolicy(p))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const toggle = async () => {
    if (!policy) return;
    setBusy(true);
    try {
      const next = await api<PolicyDto>("policy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ekaerAuto: !policy.ekaerAuto }),
      });
      setPolicy(next);
      toast(
        next.ekaerAuto
          ? "Automatikus EKÁER bekapcsolva"
          : "Automatikus EKÁER kikapcsolva",
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert lvl="bad">{error}</Alert>;
  if (!policy) return <Small>Betöltés…</Small>;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <h2>Automatikus EKÁER-bejelentés</h2>
          <p className="mt-1">
            Bekapcsolva a második mérésnél a rendszer maga jelenti be az EKÁER-t
            a mért nettó tömeggel, még indulás előtt. Csak akkor, ha minden adat
            megvan:
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>a termék EKÁER-köteles, 8 jegyű VTSZ-szel és árral (Ft/t);</li>
            <li>
              a vevőnek van adószáma és „irányítószám település, utca” formájú
              címe.
            </li>
          </ul>
          <Small className="mt-2">
            Ha bármi hiányzik, nem indul magától; a Mérleg oldalon kézzel
            bejelenthető. Az érték: nettó tonna × ár. Minden átállítás a naplóba
            kerül.
          </Small>
        </div>
        <div className="flex flex-col items-end gap-2">
          {policy.ekaerAuto ? (
            <Pill tone="success">Bekapcsolva</Pill>
          ) : (
            <Pill tone="neutral">Kikapcsolva</Pill>
          )}
          <Btn
            kind={policy.ekaerAuto ? "bad" : "pri"}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {policy.ekaerAuto ? "Kikapcsolás" : "Bekapcsolás"}
          </Btn>
        </div>
      </div>
    </Panel>
  );
}
