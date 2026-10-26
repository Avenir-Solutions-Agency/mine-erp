"use client";

import {
  ds,
  fmt,
  ft,
  iso,
  mft,
  pct,
  stageName,
  tn,
} from "@mine-erp/domain/demo";
import { BarChart, LineChart } from "@/prototype/charts";
import { useDemo } from "@/prototype/store";
import { pillTone } from "@/prototype/status-pill";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AiBox,
  Btn,
  Field,
  Flow,
  Grid,
  Inp,
  Legend,
  Panel,
  Row,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";

// R.pnl
export function PnlTab() {
  const { S, q } = useDemo();
  const cm = q.costModel();
  const p = cm.pools;
  const rows: [string, number][] = [
    ["Árbevétel — termék", cm.revenue - cm.freightRev],
    ["Árbevétel — fuvardíj", cm.freightRev],
    ["Beszerzett áru", -cm.buyCost],
    ["Kitermelés", -p.kitermeles],
    ["Törés-osztályozás", -p.toro],
    ["Rakodás-mérlegelés", -p.rakodas],
    ["Fuvar", -p.fuvar],
    ["Rezsi (bányajáradékkal)", -p.rezsi],
  ];
  const ebit = cm.revenue - cm.totalCost;
  const dep = S.machines.reduce((a, m) => a + m.dep, 0);
  const months = [...S.pnl.months, "szept."];
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Szeptember</h2>
        <Table>
          <TableBody>
            {rows.map(([n, v]) => (
              <TableRow key={n}>
                <TableCell>{n}</TableCell>
                <TableCell numeric>{ft(v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Üzemi eredmény (EBIT)</TableCell>
              <TableCell numeric>{ft(ebit)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>EBITDA</TableCell>
              <TableCell numeric>{ft(ebit + dep)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Panel>
      <Panel>
        <h2>Hat hónap</h2>
        <BarChart
          labels={months}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hónap</TableHead>
              <TableHead numeric>Árbevétel</TableHead>
              <TableHead numeric>Költség</TableHead>
              <TableHead numeric>Eredmény</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m, i) => {
              const r = i < 5 ? S.pnl.rev[i] * 1e6 : cm.revenue;
              const c = i < 5 ? S.pnl.cost[i] * 1e6 : cm.totalCost;
              return (
                <TableRow key={m}>
                  <TableCell>{m}</TableCell>
                  <TableCell numeric>{mft(r)}</TableCell>
                  <TableCell numeric>{mft(c)}</TableCell>
                  <TableCell numeric>{mft(r - c)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </Grid>
  );
}

// R.cash
export function CashTab() {
  const { q } = useDemo();
  const cf = q.cashflow();
  return (
    <>
      <Panel>
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
          mark={{ v: 15, l: "biztonsági szint" }}
        />
      </Panel>
      <Panel className="mt-3.5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hét</TableHead>
              <TableHead numeric>Befolyó</TableHead>
              <TableHead numeric>Kifizetés</TableHead>
              <TableHead numeric>Záró egyenleg</TableHead>
              <TableHead>Fő tételek</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cf.map((w) => (
              <TableRow key={iso(w.a)}>
                <TableCell>
                  {ds(w.a)} – {ds(w.b).slice(6)}
                </TableCell>
                <TableCell numeric>{mft(w.inn)}</TableCell>
                <TableCell numeric>{mft(w.out)}</TableCell>
                <TableCell
                  numeric
                  className={w.bal < 15e6 ? "text-warning" : undefined}
                >
                  {mft(w.bal)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {w.items.map((i) => `${i[0]} ${mft(i[1])}`).join(" · ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Small className="mt-2">
          Forrás élesben: bankszámla-egyenleg (PSD2/bankexport), Billingo
          kintlévőségek, ütemezett bér- és adónaptár, jóváhagyott beszerzések,
          nyitott rendelések teljesítési üteme.
        </Small>
      </Panel>
    </>
  );
}

// R.cost
export function CostTab() {
  const { S, q, actions } = useDemo();
  const cm = q.costModel();
  return (
    <Panel>
      <h2>Önköltség terméktonnára (szeptember)</h2>
      <Small className="my-2">
        Kitermelés: termelt tonnára egyenletesen · Törés-osztályozás: törési
        intenzitás szerint súlyozva · Rakodás és rezsi: eladott tonnára ·
        Beszerzett áru: beszerzési ár. A gépköltség az üzemi raktár kiadásaival
        együtt kerül ide.
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Termék</TableHead>
            <TableHead numeric>Beszerzés</TableHead>
            <TableHead numeric>Kitermelés</TableHead>
            <TableHead numeric>Törés</TableHead>
            <TableHead numeric>Rakodás</TableHead>
            <TableHead numeric>Rezsi</TableHead>
            <TableHead numeric>Önköltség</TableHead>
            <TableHead numeric>Listaár</TableHead>
            <TableHead numeric>Fedezet</TableHead>
            <TableHead numeric>Ár célárréssel</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {S.products.map((p) => {
            const x = cm.parts[p.id];
            const u = cm.unit[p.id];
            const m = (p.price - u) / p.price;
            const rec = Math.ceil(u / (1 - S.policy.targetMargin) / 10) * 10;
            return (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell numeric>{x.base ? ft(x.base) : "—"}</TableCell>
                <TableCell numeric>{ft(x.k)}</TableCell>
                <TableCell numeric>{ft(x.t)}</TableCell>
                <TableCell numeric>{ft(x.r)}</TableCell>
                <TableCell numeric>{ft(x.o)}</TableCell>
                <TableCell numeric>
                  <b>{ft(u)}</b>
                </TableCell>
                <TableCell numeric>{ft(p.price)}</TableCell>
                <TableCell numeric>
                  <Pill
                    tone={pillTone(
                      m < S.policy.minMargin
                        ? "bad"
                        : m < S.policy.targetMargin
                          ? "warn"
                          : "ok",
                    )}
                  >
                    {pct(m)}
                  </Pill>
                </TableCell>
                <TableCell numeric>{ft(rec)}</TableCell>
                <TableCell>
                  {rec > p.price ? (
                    <Btn
                      kind="ai"
                      sm
                      onClick={() => actions.setPrice(p.id, String(rec))}
                    >
                      Ár átvétele
                    </Btn>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Grid cols={2} className="mt-3">
        <Field label="Célárrés (%)">
          <Inp
            type="number"
            step="1"
            defaultValue={S.policy.targetMargin * 100}
            onCommit={(el) => actions.setTargetMargin(el.value)}
          />
        </Field>
        <Field label="Minimum árrés (%)">
          <Inp
            type="number"
            step="1"
            defaultValue={S.policy.minMargin * 100}
            onCommit={(el) => actions.setMinMargin(el.value)}
          />
        </Field>
      </Grid>
    </Panel>
  );
}

// R.labor
export function LaborTab() {
  const { q } = useDemo();
  const cm = q.costModel();
  const tot = cm.labor.reduce((a, l) => a + l.cost, 0);
  const by: Record<string, number> = {};
  cm.labor.forEach((l) => (by[l.stage] = (by[l.stage] || 0) + l.cost));
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Bérköltség munkakörönként</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Munkakör</TableHead>
              <TableHead>Fázis</TableHead>
              <TableHead numeric>Bruttó</TableHead>
              <TableHead numeric>+ szocho 13%</TableHead>
              <TableHead numeric>Óra</TableHead>
              <TableHead numeric>Ft/óra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cm.labor.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.name}</TableCell>
                <TableCell>{stageName(l.stage)}</TableCell>
                <TableCell numeric>{ft(l.gross)}</TableCell>
                <TableCell numeric>{ft(l.cost)}</TableCell>
                <TableCell numeric>{fmt(l.h)}</TableCell>
                <TableCell numeric>{ft(l.perH)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Összes munkaerőköltség</TableCell>
              <TableCell numeric>{ft(tot)}</TableCell>
              <TableCell colSpan={2} numeric>
                {ft(tot / cm.totSold)}/eladott t
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Panel>
      <Panel>
        <h2>Fázisonként</h2>
        <BarChart
          labels={Object.keys(by).map((k) => stageName(k) ?? k)}
          series={[
            {
              n: "Bérköltség",
              c: "var(--primary)",
              v: Object.values(by).map((v) => v / 1e6),
            },
          ]}
          fmtY={(v) => fmt(v, 1) + " M"}
        />
        <Small className="mt-2">
          Élesben a jelenléti ív / gépnapló üzemórái alapján osztja a bért a
          fázisokra; a bérszámfejtésből (pl. Nexon, Kulcs-Bér) havi importtal.
        </Small>
      </Panel>
    </Grid>
  );
}

// R.mach
export function MachTab() {
  const { q } = useDemo();
  const cm = q.costModel();
  const ms = [...cm.mach].sort((a, b) => b.total - a.total);
  return (
    <Panel>
      <h2>Gépköltség megoszlása</h2>
      <Legend
        items={[
          ["var(--primary)", "Értékcsökkenés"],
          ["var(--ai)", "Üzemanyag"],
          ["var(--muted-foreground)", "Alkatrész, útdíj"],
        ]}
      />
      <BarChart
        labels={ms.map((m) => m.id)}
        series={[
          { n: "ÉCS", c: "var(--primary)", v: ms.map((m) => m.dep / 1e6) },
          { n: "Üzemanyag", c: "var(--ai)", v: ms.map((m) => m.fuelFt / 1e6) },
          {
            n: "Alkatrész",
            c: "var(--muted-foreground)",
            v: ms.map((m) => (m.parts + m.extra + (m.toll || 0)) / 1e6),
          },
        ]}
        stack
        fmtY={(v) => fmt(v, 1) + " M"}
        h={220}
      />
      <Small className="mt-2">
        {ms.map((m) => `${m.id} = ${m.name}`).join(" · ")}
      </Small>
    </Panel>
  );
}

// R.cust
export function CustTab() {
  const { q } = useDemo();
  const rows = q
    .custProfit()
    .sort((a, b) => a.margin / a.rev - b.margin / b.rev);
  return (
    <Panel>
      <h2>Vevői jövedelmezőség · szeptember</h2>
      <Small className="my-2">
        Fedezet = árbevétel − termék-önköltség − fuvar-önköltség −
        finanszírozási költség (fizetési határidő × 8,5% kamat). Ez mutatja,
        kinek mennyit ér valójában a kedvezmény és a hosszú fizetési határidő.
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vevő</TableHead>
            <TableHead numeric>Tonna</TableHead>
            <TableHead numeric>Árbevétel</TableHead>
            <TableHead numeric>Termék-önktg.</TableHead>
            <TableHead numeric>Fuvar-önktg.</TableHead>
            <TableHead numeric>Finansz.</TableHead>
            <TableHead numeric>Fedezet</TableHead>
            <TableHead numeric>%</TableHead>
            <TableHead>Feltételek</TableHead>
            <TableHead numeric>Lejárt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const m = r.margin / r.rev;
            return (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell numeric>{fmt(r.t)}</TableCell>
                <TableCell numeric>{mft(r.rev)}</TableCell>
                <TableCell numeric>{mft(r.prodCost)}</TableCell>
                <TableCell numeric>{mft(r.freightCost)}</TableCell>
                <TableCell numeric>{mft(r.fin)}</TableCell>
                <TableCell numeric>{mft(r.margin)}</TableCell>
                <TableCell numeric>
                  <Pill
                    tone={pillTone(m < 0.15 ? "bad" : m < 0.25 ? "warn" : "ok")}
                  >
                    {pct(m)}
                  </Pill>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.disc ? pct(r.disc) + " kedv. · " : ""}
                  {r.payDays} nap
                </TableCell>
                <TableCell numeric>
                  {r.overdue ? (
                    <Pill tone="destructive">
                      {mft(r.overdue)} · {r.odDays} nap
                    </Pill>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

// R.plan
export function PlanTab() {
  const { S, q, consts } = useDemo();
  const BUDGET = consts.BUDGET;
  const cm = q.costModel();
  const rows: [string, number, number, number][] = [
    ["Árbevétel", BUDGET.revenue, cm.revenue, 1],
    ...(["kitermeles", "toro", "rakodas", "fuvar", "rezsi"] as const).map(
      (k): [string, number, number, number] => [
        stageName(k) ?? k,
        BUDGET[k],
        cm.pools[k],
        -1,
      ],
    ),
  ];
  const o: string[] = [];
  if (cm.pools.toro > BUDGET.toro)
    o.push(
      `A törési költség ${mft(cm.pools.toro - BUDGET.toro)}-tal a terv felett van; fő tétel a TOR-01 Sandvik QI440 alkatrész- és külső szervizköltsége (${mft(S.machines.find((m) => m.id === "TOR-01")?.parts ?? 0)} + 2,4 M Ft).`,
    );
  if (cm.pools.kitermeles > BUDGET.kitermeles)
    o.push(
      "A kitermelésben a bérelt dömperek (8,6 M Ft) viszik el a keretet; saját dömper vásárlásának megtérülését érdemes megvizsgálni.",
    );
  if (cm.revenue < BUDGET.revenue)
    o.push(
      `Az árbevétel ${mft(BUDGET.revenue - cm.revenue)}-tal elmaradt; a földműanyag eladott mennyisége ${fmt(cm.soldT.p5)} t volt.`,
    );
  return (
    <Panel>
      <h2>Terv–tény · szeptember</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sor</TableHead>
            <TableHead numeric>Terv</TableHead>
            <TableHead numeric>Tény</TableHead>
            <TableHead numeric>Eltérés</TableHead>
            <TableHead numeric>%</TableHead>
            <TableHead>Értékelés</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([n, b, a, sg]) => {
            const d = a - b;
            const r = d / b;
            const good = sg * d >= 0;
            return (
              <TableRow key={n}>
                <TableCell>{n}</TableCell>
                <TableCell numeric>{mft(b)}</TableCell>
                <TableCell numeric>{mft(a)}</TableCell>
                <TableCell numeric>
                  {d > 0 ? "+" : ""}
                  {mft(d)}
                </TableCell>
                <TableCell numeric>
                  {d > 0 ? "+" : ""}
                  {pct(r)}
                </TableCell>
                <TableCell>
                  <Pill
                    tone={pillTone(
                      good ? "ok" : Math.abs(r) > 0.1 ? "bad" : "warn",
                    )}
                  >
                    {good ? "kedvező" : "kedvezőtlen"}
                  </Pill>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <AiBox who="Pénzügyi elemző · eltérés-magyarázat" className="mt-2.5">
        <p className="mt-1">{o.join(" ") || "Nincs jelentős eltérés."}</p>
      </AiBox>
    </Panel>
  );
}

const SLIDERS: [string, string, number, number, number, string][] = [
  ["diesel", "Gázolaj nettó ár", 450, 750, 5, " Ft/l"],
  ["wage", "Béremelés", 0, 20, 1, " %"],
  ["vol", "Eladott és termelt mennyiség", -30, 30, 5, " %"],
  ["blast", "Robbantás havi díja", 3000000, 6000000, 100000, " Ft"],
  ["price", "Általános áremelés", 0, 20, 1, " %"],
];

// R.sim
export function SimTab() {
  const { S, q, actions, view } = useDemo();
  const SIM = view.SIM;
  const base = q.costModel();
  const sc = q.withSim(() => q.costModel());
  const fixed =
    S.machines.reduce((a, m) => a + m.dep, 0) +
    S.staff.reduce((a, x) => a + x.gross * 1.13, 0) +
    S.overhead.reduce((a, o) => a + o[2], 0);
  const avgP = base.revenue / base.totSold;
  const varPerT = (base.totalCost - fixed) / base.totSold;
  const be = fixed / (avgP - varPerT);
  const cmp: [string, string, string][] = [
    [
      "Üzemi eredmény",
      mft(base.revenue - base.totalCost),
      mft(sc.revenue - sc.totalCost),
    ],
    [
      "Árrés",
      pct((base.revenue - base.totalCost) / base.revenue),
      pct((sc.revenue - sc.totalCost) / sc.revenue),
    ],
    ["Fuvar Ft/km", ft(base.ftPerKm), ft(sc.ftPerKm)],
  ];
  return (
    <>
      <Grid cols={2}>
        <Panel>
          <h2>Mi lenne, ha…</h2>
          <Stack>
            {SLIDERS.map(([id, l, min, max, step, u]) => (
              <Field
                key={id}
                label={
                  <>
                    {l}:{" "}
                    <b>
                      {fmt(SIM[id])}
                      {u}
                    </b>
                  </>
                }
              >
                <Inp
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  defaultValue={SIM[id]}
                  onCommit={(el) => actions.setSim(id, el.value)}
                />
              </Field>
            ))}
            <Row>
              <Btn sm onClick={() => actions.resetSim()}>
                Alaphelyzet
              </Btn>
            </Row>
          </Stack>
        </Panel>
        <Panel>
          <h2>Hatás</h2>
          <Table>
            <TableBody>
              {cmp.map(([n, a, b]) => (
                <TableRow key={n}>
                  <TableCell>{n}</TableCell>
                  <TableCell numeric>{a}</TableCell>
                  <TableCell numeric>
                    <b>{b}</b>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Small className="mt-2">
            Fedezeti pont (jelenlegi struktúrával): <b>{fmt(be)} t/hó</b> eladás
            · fix költség {mft(fixed)}/hó, változó {ft(varPerT)}/t.
          </Small>
        </Panel>
      </Grid>
      <Panel className="mt-3.5">
        <h2>Önköltség és javasolt ár a forgatókönyvben</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termék</TableHead>
              <TableHead numeric>Önköltség most</TableHead>
              <TableHead numeric>Forgatókönyv</TableHead>
              <TableHead numeric>Változás</TableHead>
              <TableHead numeric>Ár célárréssel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.products.map((p) => {
              const a = base.unit[p.id];
              const b = sc.unit[p.id];
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell numeric>{ft(a)}</TableCell>
                  <TableCell numeric>{ft(b)}</TableCell>
                  <TableCell numeric>
                    {b > a ? "+" : ""}
                    {pct(b / a - 1)}
                  </TableCell>
                  <TableCell numeric>
                    {ft(Math.ceil(b / (1 - S.policy.targetMargin) / 10) * 10)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// R.mb (round 5)
export function MbTab() {
  const { S, actions, view } = useDemo();
  const d = view.MB.date;
  const mv = S.stockMoves;
  const before = (pid: string) =>
    mv
      .filter((m) => m.pid === pid && iso(m.date) < d)
      .reduce((a, m) => a + m.qty, 0);
  const on = (pid: string, re: RegExp) =>
    mv
      .filter((m) => m.pid === pid && iso(m.date) === d && re.test(m.type))
      .reduce((a, m) => a + m.qty, 0);
  const rows = S.products
    .map((p) => ({
      p,
      o: before(p.id),
      prod: on(p.id, /gyártás|beszerzés/),
      sold: on(p.id, /eladás/),
      oth: on(p.id, /átszállítás|helyesbítés|saját/),
    }))
    .map((r) => ({ ...r, c: r.o + r.prod + r.sold + r.oth }));
  const feed = (S.shifts || [])
    .filter((x) => iso(x.date) === d)
    .reduce((a, x) => a + x.inT, 0);
  const out =
    rows.reduce((a, r) => a + r.prod, 0) -
    rows.filter((r) => r.p.src === "buy").reduce((a, r) => a + r.prod, 0);
  const osztOut = S.mlog
    .filter((x) => iso(x.date) === d && x.prod)
    .reduce(
      (a, x) => a + Object.values(x.prod ?? {}).reduce((b, v) => b + v, 0),
      0,
    );
  return (
    <Panel>
      <Spread>
        <h2>Napi anyagmérleg</h2>
        <Field label="Nap">
          <Inp
            type="date"
            defaultValue={d}
            onCommit={(el) => actions.setMbDate(el.value)}
          />
        </Field>
      </Spread>
      <Flow
        className="my-2"
        steps={[
          [`Kitermelés / feladás ${tn(feed)}`, true],
          ["Törés, osztályozás", true],
          [`Késztermék ${tn(out)}`, true],
          [`Veszteség, meddő ${tn(Math.max(0, feed - out + osztOut))}`, false],
        ]}
      />
      <Small className="mb-2">
        ERP-készlet = tegnapi zárókészlet + mai termelés − mai értékesítés ±
        átszállítás és helyesbítés. A termelés forrása:{" "}
        {feed ? "műszaknapló (kanálmérleg)" : ""}
        {osztOut ? " + szalagmérleg (OSZT-01)" : ""}
        {!feed && !osztOut ? "nincs termelés ezen a napon" : ""}. Fizikai
        ellenőrzés: havi drónos felmérés.
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Frakció</TableHead>
            <TableHead numeric>Nyitó</TableHead>
            <TableHead numeric>+ Termelés</TableHead>
            <TableHead numeric>− Értékesítés</TableHead>
            <TableHead numeric>± Egyéb</TableHead>
            <TableHead numeric>Záró ERP-készlet</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.p.id}>
              <TableCell>{r.p.name}</TableCell>
              <TableCell numeric>{fmt(r.o)}</TableCell>
              <TableCell numeric>{r.prod ? "+" + fmt(r.prod) : "—"}</TableCell>
              <TableCell numeric>{r.sold ? fmt(r.sold, 1) : "—"}</TableCell>
              <TableCell numeric>{r.oth ? fmt(r.oth, 1) : "—"}</TableCell>
              <TableCell numeric>
                <b>{fmt(r.c)}</b>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
