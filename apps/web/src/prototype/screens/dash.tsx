"use client";

import { ds, fmt, ft, mft, pct, tn } from "@mine-erp/domain/demo";
import { BarChart, LineChart } from "@/prototype/charts";
import { useDemo } from "@/prototype/store";
import { pillTone } from "@/prototype/status-pill";
import { Pill } from "@/components/ui/pill";
import { Kpi } from "@/components/ui/kpi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AiBox,
  Alert,
  Btn,
  formValue,
  Grid,
  Head,
  Inp,
  Legend,
  Panel,
  Row,
  Spread,
  type Level,
} from "@/prototype/ui";

const QUICK = [
  "Melyik vevő hozza a legkevesebb fedezetet?",
  "Mennyivel emeljem a földműanyag árát?",
  "Mikor lesz szűk a pénz, és mit halasszak?",
  "Melyik gép a legdrágább tonnára vetítve?",
  "Mi történt ma?",
  "Miért termeltünk ma kevesebbet?",
];

// V.dash with the round-2 "Kérdezze az ERP-t" box.
export function DashScreen() {
  const demo = useDemo();
  const { S, q, actions, ui } = demo;
  const cm = q.costModel();
  const c = q.counts();
  const ebit = cm.revenue - cm.totalCost;
  const cf = q.cashflow();
  const minW = cf.reduce((m, w) => (w.bal < m.bal ? w : m), cf[0]);
  const alerts: { lvl: Level; t: string }[] = [];
  S.products.forEach((p) => {
    const s = q.stockOf(p.id) - q.reservedOf(p.id);
    if (s < p.min)
      alerts.push({
        lvl: s < 0 ? "bad" : "warn",
        t: `${p.name}: szabad készlet ${tn(s)} (minimum ${tn(p.min)})`,
      });
  });
  q.reorderSuggestions()
    .filter((s) => s.need)
    .forEach((s) =>
      alerts.push({
        lvl: "warn",
        t: `Üzemi raktár: ${s.name} — ${fmt(s.cover)} napra elég, szállítási idő ${s.lead} nap`,
      }),
    );
  S.machines
    .filter((m) => m.stage !== "fuvar" && m.next < 50)
    .forEach((m) =>
      alerts.push({
        lvl: "bad",
        t: `${m.name}: szerviz ${m.next} üzemóra múlva esedékes`,
      }),
    );
  S.clients
    .filter((cl) => cl.limit && cl.used / cl.limit > 0.85)
    .forEach((cl) =>
      alerts.push({
        lvl: "warn",
        t: `${cl.name}: hitelkeret ${pct(cl.used / cl.limit)} kihasználva`,
      }),
    );
  const unitRows = S.products
    .map((p) => ({ p, m: (p.price - cm.unit[p.id]) / p.price }))
    .sort((a, b) => a.m - b.m);
  const marginTone = (m: number) =>
    pillTone(
      m < S.policy.minMargin
        ? "bad"
        : m < S.policy.targetMargin
          ? "warn"
          : "ok",
    );
  const sample = ui.sample;

  return (
    <>
      <Head
        title="Tulajdonosi irányítópult"
        sub="Szeptember zárt hónap, október élő adatok. Minden szám a készletnaplóból, a gép-, bér- és rezsitörzsből számolódik."
      />
      <Grid cols={4}>
        <Kpi
          label="Árbevétel · szept."
          value={mft(cm.revenue)}
          detail={`ebből fuvardíj ${mft(cm.freightRev)}`}
        />
        <Kpi
          label="Üzemi eredmény · szept."
          value={mft(ebit)}
          detail={`árrés ${pct(ebit / cm.revenue)} · amortizációval`}
        />
        <Kpi
          label="Legalacsonyabb pénzállás · 13 hét"
          value={
            <span className={minW.bal < 15e6 ? "text-warning" : undefined}>
              {mft(minW.bal)}
            </span>
          }
          detail={`${ds(minW.a)} hete`}
        />
        <Kpi
          label="Döntésre vár"
          value={<span className="text-ai">{c.ap}</span>}
          detail={
            <Btn kind="ai" sm onClick={() => demo.go("ai")}>
              Jóváhagyások megnyitása
            </Btn>
          }
        />
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <Spread>
            <h2>Árbevétel és költség</h2>
            <Legend
              items={[
                ["var(--primary)", "Árbevétel"],
                ["var(--muted-foreground)", "Költség"],
              ]}
            />
          </Spread>
          <BarChart
            labels={[...S.pnl.months, "szept."]}
            series={[
              {
                n: "Árbevétel",
                c: "var(--primary)",
                v: [...S.pnl.rev, cm.revenue / 1e6],
              },
              {
                n: "Költség",
                c: "var(--muted-foreground)",
                v: [...S.pnl.cost, cm.totalCost / 1e6],
              },
            ]}
            fmtY={(v) => fmt(v) + " M"}
          />
        </Panel>
        <Panel>
          <Spread>
            <h2>Pénzállás, 13 hetes előrejelzés</h2>
            <Btn sm onClick={() => actions.openReport("cash")}>
              Részletek
            </Btn>
          </Spread>
          <LineChart
            labels={cf.map((w) => ds(w.a).slice(6, 13))}
            series={[
              {
                n: "Záró",
                c: "var(--primary)",
                v: cf.map((w) => w.bal / 1e6),
                area: true,
              },
            ]}
            fmtY={(v) => fmt(v) + " M"}
            mark={{ v: 15, l: "15 M Ft biztonsági szint" }}
          />
        </Panel>
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Figyelmeztetések</h2>
          {alerts.length ? (
            alerts.map((a, i) => (
              <Alert key={i} lvl={a.lvl}>
                {a.t}
              </Alert>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Nincs nyitott figyelmeztetés.
            </p>
          )}
        </Panel>
        <Panel>
          <Spread>
            <h2>Termékek fedezete</h2>
            <Btn sm onClick={() => actions.openReport("cost")}>
              Önköltség-számítás
            </Btn>
          </Spread>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Termék</TableHead>
                <TableHead numeric>Önköltség</TableHead>
                <TableHead numeric>Listaár</TableHead>
                <TableHead numeric>Fedezet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitRows.map(({ p, m }) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell numeric>{ft(cm.unit[p.id])}</TableCell>
                  <TableCell numeric>{ft(p.price)}</TableCell>
                  <TableCell numeric>
                    <Pill tone={marginTone(m)}>{pct(m)}</Pill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Grid>
      <Panel className="mt-3.5">
        <Spread>
          <h2>Kérdezze az ERP-t</h2>
          <Pill tone="ai">élő Claude, az ERP adataival</Pill>
        </Spread>
        {sample ? (
          <AskBox />
        ) : (
          <p className="text-xs text-muted-foreground">
            Ebben a nézetben a Claude-hívás nem érhető el. A megosztott,
            claude.ai-ban megnyitott oldalon a tulajdonos szabad szöveges
            kérdést tehet fel; a modell az ERP eredmény-, önköltség-, készlet-,
            cash-flow-, gép- és vevőadatait eszközként éri el.
          </p>
        )}
      </Panel>
      <AiBox who="Pénzügyi elemző · heti összefoglaló" className="mt-3.5">
        <p className="mt-1.5">{q.insights(cm, cf).join(" ")}</p>
      </AiBox>
    </>
  );
}

function AskBox() {
  const { S, actions } = useDemo();
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Row>
        <Inp
          name="q"
          defaultValue={S.ask.q}
          aria-label="Kérdés"
          className="min-w-55 flex-1"
        />
        <Btn
          kind="ai"
          disabled={S.ask.busy}
          onClick={(e) =>
            void actions.ask(formValue(e.currentTarget.form, "q"))
          }
        >
          {S.ask.busy ? "Gondolkodik…" : "Kérdezek"}
        </Btn>
      </Row>
      <Row className="mt-1.5 text-xs">
        {QUICK.map((qq) => (
          <Btn key={qq} sm onClick={() => actions.askQuick(qq)}>
            {qq}
          </Btn>
        ))}
      </Row>
      <div className="mt-2.5 whitespace-pre-wrap">
        {S.ask.busy && !S.ask.a ? "Gondolkodik…" : S.ask.a}
      </div>
    </form>
  );
}
