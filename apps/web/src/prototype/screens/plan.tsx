"use client";

import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Flow, Grid, Head, Panel } from "@/prototype/ui";

const STEPS = [
  "Ajánlatkérés (web, e-mail, telefon-jegyzet)",
  "AI értelmezés + ügyfélazonosítás",
  "Árazás önköltségből + fuvar",
  "Házirend: auto-küldés vagy jóváhagyás",
  "Elfogadó link → megrendelés",
  "Fuvarütemezés autókra",
  "EKÁER-döntés és bejelentés",
  "Mérlegjegy → készletcsökkenés",
  "Szállítólevél (Billingo)",
  "Számla (Billingo → NAV)",
  "Befolyás figyelése, cash-flow",
];

const TECH: [string, string][] = [
  [
    "Adatbázis",
    "PostgreSQL, eseménynapló (készlet- és pénzmozgás), sor-szintű jogosultság",
  ],
  [
    "Backend",
    "TypeScript (NestJS) vagy a meglévő GraphQL API rendbetéve; háttérfeladatok: Temporal / BullMQ",
  ],
  [
    "Frontend",
    "A meglévő Nuxt 3 + PrimeVue, 12 órás munkamenet, refresh token, magyar lokalizáció",
  ],
  [
    "AI",
    "Claude API eszközhívással; minden ügynök csak a saját API-végpontjait éri el; napló + emberi jóváhagyás",
  ],
  ["Mobil", "Sofőr- és mérlegkezelő PWA: fotó, aláírás, offline sor"],
];

const INTEGR: [string, string][] = [
  [
    "Billingo API v3",
    "Partner-szinkron, szállítólevél és számla, fizetés-státusz visszaolvasás; NAV Online Számla a Billingón át",
  ],
  [
    "NAV EKÁER",
    "Gépi interfész: bejelentés, módosítás (tömeg, rendszám), lezárás; technikai felhasználó",
  ],
  [
    "Hídmérleg",
    "Mérlegszoftver export / soros port → nettó tömeg, mérlegjegy PDF",
  ],
  ["E-mail", "Microsoft 365 / Gmail webhook a vevo@ fiókra"],
  ["Bank", "Napi kivonat-import, kiegyenlítés párosítás"],
  ["Üzemanyag", "Kútautomata, GPS/tachográf km"],
];

const ROLLOUT: [string, string, string][] = [
  ["Felmérés", "1–2. hó", "folyamatok, adatok, hozzáférések, platformdöntés"],
  [
    "1. ütem: ERP-alap",
    "3–4. hó",
    "ügyfél, beszállító, rendelés, számlázás (Billingo, NAV), mérleg, könyvelési feladás, hulladéklerakó",
  ],
  [
    "2. ütem: Operáció",
    "5–7. hó",
    "fuvarszervezés, GPS, gépüzemnapló, szerviz, QR-raktár, üzemanyag, bányatermelés",
  ],
  [
    "3. ütem: Automatizáció",
    "8–9. hó",
    "EKÁER, bank, dokumentum-AI, rendszámfelismerés, mobilfelületek",
  ],
  [
    "4. ütem: AI + controlling",
    "10–12. hó",
    "„Ma” nézet, fedezetszámítás, anomáliafigyelés, vezetői AI-asszisztens",
  ],
];

function Pairs({ rows }: { rows: [ReactNode, string][] }) {
  return (
    <Table>
      <TableBody>
        {rows.map(([k, v], i) => (
          <TableRow key={i}>
            <TableCell>{k}</TableCell>
            <TableCell>{v}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// V.plan with the round-5 rollout panel.
export function PlanScreen() {
  return (
    <>
      <Head
        title="Rendszerterv"
        sub="A demó mögötti éles architektúra röviden. A teljes terv a projekt dokumentumai között: „Mine ERP 2.0 — rendszerterv”."
      />
      <Grid cols={3}>
        <Panel>
          <h2>Folyamat</h2>
          <Flow
            vertical
            steps={STEPS.map((s, i) => [`${i + 1}. ${s}`, i % 2 === 0])}
          />
        </Panel>
        <Panel>
          <h2>Technológia</h2>
          <Pairs rows={TECH} />
        </Panel>
        <Panel>
          <h2>Integrációk</h2>
          <Pairs rows={INTEGR} />
        </Panel>
      </Grid>
      <Panel className="mt-3.5">
        <h2>Bevezetés a brief négy üteme szerint</h2>
        <Pairs
          rows={ROLLOUT.map(([b, t, v]) => [
            <>
              <b>{b}</b> · {t}
            </>,
            v,
          ])}
        />
      </Panel>
    </>
  );
}
