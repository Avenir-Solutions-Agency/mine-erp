"use client";

import { fmt, ft, mft, pct, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { Kpi } from "@/components/ui/kpi";
import { Pill } from "@/components/ui/pill";
import {
  AiBox,
  Bar,
  Btn,
  Grid,
  Head,
  Panel,
  Row,
  Small,
  Spread,
} from "@/prototype/ui";

const ASK = ["Mi történt ma?", "Miért termeltünk ma kevesebbet?"];

export function TodayScreen() {
  const { S, q, actions, ui } = useDemo();
  const s = q.todaySummary();
  const mx = Math.max(...s.stock.map((x) => x.t));
  const tiles: [string, string, string, string?][] = [
    ["Mai kitermelés (feladás)", tn(s.feed), "műszaknapló + kanálmérleg"],
    ["Kiszállítva", tn(s.tons), `${s.tripsDone}/${s.trips} forduló`],
    ["Árbevétel ma", mft(s.rev), "termék + fuvardíj"],
    ["Fedezet ma", mft(s.margin), s.rev ? pct(s.margin / s.rev) : ""],
    ["Dolgozó autó", `${s.working}/${s.trucks}`, ""],
    [
      "Várakozás",
      s.loadWait != null ? fmt(s.loadWait) + " perc" : "—",
      `rakodás · lerakón ${s.dropWait != null ? fmt(s.dropWait) + " perc" : "—"}`,
    ],
    ["Üzemanyag ma", fmt(s.fuel) + " l", "RFID-tankolás"],
    [
      "Gépállás ma",
      fmt(s.idle, 1) + " h",
      s.idleWhy.join("; ") || "",
      s.idle > 2 ? "text-warning" : "",
    ],
    ["Kintlévőség", mft(s.ar), ""],
    ["Lejárt", mft(s.overdue), "", s.overdue ? "text-destructive" : ""],
  ];
  const prod = Object.entries(s.prodByM);
  const issues = [...s.service, ...s.faults];

  return (
    <>
      <Head
        title="Ma"
        sub="A tulajdonos egy képernyője telefonra: mi történt ma a bányában, a gépeken, az utakon és a pénzben. A brief 18. pontjának mutatói."
      />
      <div className="max-w-110 rounded-2xl border border-border bg-card p-4">
        <Grid cols={2}>
          {tiles.map(([l, v, d, c]) => (
            <Kpi
              key={l}
              label={l}
              value={<span className={c || undefined}>{v}</span>}
              detail={d}
            />
          ))}
        </Grid>
        <Panel className="mt-2.5">
          <h3>Termelés gépenként ma</h3>
          {prod.length ? (
            prod.map(([k, v]) => (
              <Spread key={k} className="text-xs text-muted-foreground">
                <span>{k}</span>
                <b>{tn(v)}</b>
              </Spread>
            ))
          ) : (
            <p className="my-3 text-xs text-muted-foreground">
              Ma még nincs termelés.
            </p>
          )}
        </Panel>
        <Panel className="mt-2.5">
          <h3>Szervizben, hibák</h3>
          {issues.length ? (
            issues.map((x, i) => <Small key={i}>• {x}</Small>)
          ) : (
            <p className="my-3 text-xs text-muted-foreground">Nincs.</p>
          )}
        </Panel>
        <Panel className="mt-2.5">
          <h3>Készlet frakciónként</h3>
          {s.stock.map((x) => (
            <div key={x.name}>
              <Spread className="text-xs text-muted-foreground">
                <span>{x.name}</span>
                <span className="font-mono">{fmt(x.t)} t</span>
              </Spread>
              <Bar pct={Math.max(2, (x.t / mx) * 100)} label={x.name} />
            </div>
          ))}
        </Panel>
        <Panel className="mt-2.5">
          <h3>Vevők fedezete (hónap)</h3>
          {s.cust.map((c) => (
            <Spread key={c.name} className="text-xs text-muted-foreground">
              <span>{c.name}</span>
              <Pill
                tone={
                  c.pct < 0.15
                    ? "destructive"
                    : c.pct < 0.25
                      ? "warning"
                      : "success"
                }
              >
                {pct(c.pct)}
              </Pill>
            </Spread>
          ))}
        </Panel>
        <Panel className="mt-2.5">
          <h3>Gépek Ft/üzemóra</h3>
          {s.mach.map((m) => (
            <Spread key={m.id} className="text-xs text-muted-foreground">
              <span>{m.id}</span>
              <span className="font-mono">{ft(m.perH)}</span>
            </Spread>
          ))}
          <Small className="mt-1.5">Ft/t: Riportok → Gépköltség</Small>
        </Panel>
        <AiBox who="Mészkő-Polgár AI" className="mt-2.5">
          {ui.sample ? (
            <>
              <Row>
                {ASK.map((a) => (
                  <Btn key={a} kind="ai" sm onClick={() => actions.askQuick(a)}>
                    {a}
                  </Btn>
                ))}
              </Row>
              <div className="mt-2 whitespace-pre-wrap">
                {S.ask.busy && !S.ask.a ? "Gondolkodik…" : S.ask.a}
              </div>
            </>
          ) : (
            <p className="my-3 text-xs text-muted-foreground">
              A claude.ai-ban megnyitva a tulajdonos itt kérdezhet: „Mi történt
              ma?”
            </p>
          )}
        </AiBox>
      </div>
    </>
  );
}
