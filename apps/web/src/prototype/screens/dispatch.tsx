"use client";

import {
  addDays,
  DPARAM,
  ds,
  fmt,
  fmtH,
  ft,
  iso,
  pct,
  tn,
  VPARAM,
  type ParamDef,
} from "@mine-erp/domain/demo";
import type { Driver, Transport, Truck } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
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
  Alert,
  Bar,
  Btn,
  Field,
  Grid,
  Head,
  Inp,
  Legend,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
  TabBar,
} from "@/prototype/ui";
import { cn } from "@/lib/utils";
import { Timeline, TripPanel, useClientColor } from "./dispatch-parts";

const TABS: [string, string][] = [
  ["day", "Napi terv"],
  ["week", "Heti naptár"],
  ["list", "Fuvarlista"],
  ["res", "Járművek és sofőrök"],
  ["rules", "Szabályok"],
];
const WEEKDAY = [
  "vasárnap",
  "hétfő",
  "kedd",
  "szerda",
  "csütörtök",
  "péntek",
  "szombat",
];
const WD = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
const CAL = "min-w-24 border border-border align-top";

// V.dispatch with the round-5 "Napi tonnacél" tab.
export function DispatchScreen() {
  const demo = useDemo();
  const { S, actions, view } = demo;
  const t = view.DISP.tab;
  const pend = S.transports.filter((f) => f.status === "Javasolt").length;
  // Demo quirk: the round-5 patch matches the unselected "Szabályok" tab, so on that tab "Napi tonnacél" is missing.
  const tabs: [string, string][] =
    t === "rules" ? TABS : [...TABS, ["cap", "Napi tonnacél"]];
  return (
    <>
      <Head
        title="Fuvarszervezés"
        sub="A rendszer minden fuvarhoz kiszámolja a legjobb jármű–sofőr párost 30 paraméter alapján (kemény korlátok + költség). A diszpécser mindent módosíthat, és ő fogadja el a tervet; elfogadás után indul az EKÁER-bejelentés és a sofőr appja."
        right={<Pill tone="ai">{pend} javaslat vár elfogadásra</Pill>}
      />
      <TabBar items={tabs} active={t} onSelect={actions.dispTab} />
      {t === "day" ? <DayTab /> : null}
      {t === "week" ? <WeekTab /> : null}
      {t === "list" ? <ListTab /> : null}
      {t === "res" ? <ResTab /> : null}
      {t === "rules" ? <RulesTab /> : null}
      {t === "cap" ? <CapTab /> : null}
    </>
  );
}

function DayTab() {
  const { S, q, actions, view } = useDemo();
  const clientColor = useClientColor();
  const DISP = view.DISP;
  const date = DISP.date;
  const ts = q.dayTrips(date);
  const pend = ts.filter((f) => f.status === "Javasolt");
  const confl = ts.filter((f) => f.warn && f.warn.length);
  const tons = ts.reduce((a, f) => a + f.planned, 0);
  const open = S.orders
    .filter((o) => o.status !== "Lezárva" && o.status !== "Teljesítve")
    .map((o) => ({
      o,
      rest: o.lines.reduce(
        (a, l) =>
          a + l.qty - (o.planned[l.pid] || 0) - (o.delivered[l.pid] || 0),
        0,
      ),
    }))
    .filter((x) => x.rest > 0.1);
  return (
    <>
      <Spread className="mb-2.5">
        <Row>
          <Btn sm aria-label="Előző nap" onClick={() => actions.dispDay(-1)}>
            ‹
          </Btn>
          <Inp
            type="date"
            aria-label="Nap"
            defaultValue={iso(date)}
            onCommit={(el) => actions.dispSetDay(el.value)}
          />
          <Btn sm aria-label="Következő nap" onClick={() => actions.dispDay(1)}>
            ›
          </Btn>
          <Small>
            {WEEKDAY[date.getDay()]}
            {date.getDay() === 0 ? " · kamionstop" : ""}
          </Small>
        </Row>
        <Row>
          <Field label="Sorok">
            <Sel
              defaultValue={DISP.rows}
              onCommit={(el) => actions.dispRows(el.value)}
            >
              <option value="truck">Járművek</option>
              <option value="driver">Sofőrök</option>
            </Sel>
          </Field>
          <Btn kind="ai" onClick={actions.dispAuto}>
            Automatikus kiosztás újrafuttatása
          </Btn>
          <Btn
            kind="pri"
            disabled={!pend.length}
            onClick={actions.dispAcceptAll}
          >
            Nap tervének elfogadása ({pend.length})
          </Btn>
        </Row>
      </Spread>
      <Grid cols={4}>
        <Kpi label="Fuvar" value={ts.length} detail={tn(tons)} />
        <Kpi
          label="Elfogadásra vár"
          value={<span className="text-ai">{pend.length}</span>}
        />
        <Kpi
          label="Ütközés, figyelmeztetés"
          value={
            <span className={confl.length ? "text-destructive" : undefined}>
              {confl.length}
            </span>
          }
        />
        <Kpi
          label="Flotta-kihasználtság"
          value={pct(
            S.trucks.reduce((a, x) => a + q.truckDay(x.id, date).work, 0) /
              (S.trucks.length * 12),
          )}
        />
      </Grid>
      <Panel className="mt-3.5">
        <Legend
          items={S.clients.map((c) => [clientColor(c.name), c.name])}
          extra={
            <span>
              szaggatott = javaslat · piros keret = ütközés · pirosas sáv =
              munkaidő vége · a blokk áthúzható másik sorba vagy időpontra
            </span>
          }
        />
        <Timeline date={date} />
      </Panel>
      <Grid cols={2} className="mt-3.5">
        <div>
          <TripPanel f={S.transports.find((f) => f.id === DISP.sel)} />
        </div>
        <Panel>
          <h2>Nem ütemezett mennyiség</h2>
          {open.length ? (
            open.map(({ o, rest }) => (
              <Alert key={o.id} lvl="warn">
                {o.id} · {o.clientName}: {tn(rest)} kiírásra vár{" "}
                <Btn kind="ai" sm onClick={() => actions.planClick(o.id)}>
                  Fuvarok javaslata
                </Btn>
              </Alert>
            ))
          ) : (
            <p className="my-3 text-xs text-muted-foreground">
              Minden megrendelt mennyiség ütemezve.
            </p>
          )}
          <h3 className="mt-3">Figyelmeztetések</h3>
          {confl.length ? (
            confl.map((f) => (
              <Alert key={f.id} lvl="bad">
                <a
                  href="#"
                  className="text-primary underline"
                  onClick={(e) => {
                    e.preventDefault();
                    actions.dispSelect(f.id);
                  }}
                >
                  {f.id}
                </a>
                : {f.warn!.join("; ")}
              </Alert>
            ))
          ) : (
            <p className="my-3 text-xs text-muted-foreground">Nincs ütközés.</p>
          )}
        </Panel>
      </Grid>
    </>
  );
}

function WeekTab() {
  const { S, q, actions, view } = useDemo();
  const clientColor = useClientColor();
  const start = view.DISP.week;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const off = (d: Date) => (d.getDay() === 0 ? "bg-muted" : undefined);
  const dayHeads = days.map((d) => (
    <TableHead key={iso(d)} className={cn(CAL, off(d))}>
      {WD[d.getDay()]} {ds(d).slice(6)}
    </TableHead>
  ));
  const orderRows = days.flatMap((d) => {
    const by: Record<string, Transport[]> = {};
    q.dayTrips(d).forEach((f) => {
      (by[f.order] = by[f.order] || []).push(f);
    });
    return Object.entries(by).map(([oid, fs]) => (
      <TableRow
        key={`${iso(d)}-${oid}`}
        className="cursor-pointer"
        onClick={() => actions.dispGoto(iso(d))}
      >
        <TableCell>{ds(d)}</TableCell>
        <TableCell className="font-mono">{oid}</TableCell>
        <TableCell>{fs[0].clientName}</TableCell>
        <TableCell numeric>{fs.length}</TableCell>
        <TableCell numeric>
          {tn(fs.reduce((a, f) => a + f.planned, 0))}
        </TableCell>
        <TableCell>
          <StatusPill
            status={
              fs.some((f) => f.status === "Javasolt") ? "Javasolt" : "Tervezett"
            }
          />
        </TableCell>
      </TableRow>
    ));
  });
  return (
    <>
      <Row className="mb-2.5">
        <Btn sm onClick={() => actions.dispWeek(-7)}>
          ‹ előző hét
        </Btn>
        <Mono>
          {ds(days[0])} – {ds(days[6])}
        </Mono>
        <Btn sm onClick={() => actions.dispWeek(7)}>
          következő hét ›
        </Btn>
      </Row>
      <Panel>
        <h2>Járművek foglaltsága</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={CAL}>Jármű</TableHead>
              {dayHeads}
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.trucks.map((tr) => (
              <TableRow key={tr.id}>
                <TableCell className={CAL}>
                  <b>{tr.id}</b>
                  <Small>
                    {tr.type}, {tr.cap} t
                  </Small>
                </TableCell>
                {days.map((d) => {
                  const td = q.truckDay(tr.id, d);
                  const ts = q.dayTrips(d, (f) => f.truck === tr.id);
                  const occ = td.work / 12;
                  const wo =
                    S.wos &&
                    S.wos.some(
                      (w) =>
                        w.machine === tr.id &&
                        w.status !== "Lezárva" &&
                        iso(w.due) === iso(d),
                    );
                  return (
                    <TableCell
                      key={iso(d)}
                      className={cn(CAL, off(d), "cursor-pointer")}
                      onClick={() => actions.dispGoto(iso(d))}
                    >
                      {wo ? <Pill tone="warning">szerviz</Pill> : null}
                      {ts.length ? (
                        <>
                          <Bar
                            pct={occ * 100}
                            tone={occ > 1 ? "bad" : occ > 0.85 ? "warn" : ""}
                            label="Foglaltság"
                          />
                          <Small>
                            {ts.length} forduló · {pct(occ)}
                          </Small>
                          <div className="mt-0.75 flex gap-0.75">
                            {[...new Set(ts.map((f) => f.clientName))].map(
                              (n) => (
                                <i
                                  key={n}
                                  title={n}
                                  className="inline-block size-2.5 rounded-xs"
                                  style={{ background: clientColor(n) }}
                                />
                              ),
                            )}
                          </div>
                        </>
                      ) : (
                        <Small>szabad</Small>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel className="mt-3.5">
        <h2>Sofőrök beosztása</h2>
        <p className="my-3 text-xs text-muted-foreground">
          Kattintás egy cellára: szabadság be/ki (a javaslatmotor azonnal
          figyelembe veszi).
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={CAL}>Sofőr</TableHead>
              {dayHeads}
              <TableHead numeric className={CAL}>
                Heti vez.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.drivers.map((dr) => {
              const w = q.weekDrive(dr, addDays(days[6], 1));
              return (
                <TableRow key={dr.id}>
                  <TableCell className={CAL}>
                    <b>{dr.name}</b>
                    <Small>
                      {dr.lic} · eco {dr.eco}
                    </Small>
                  </TableCell>
                  {days.map((d) => {
                    const lv = q.isLeave(dr, d);
                    const dd = q.driverDay(dr.id, d);
                    return (
                      <TableCell
                        key={iso(d)}
                        className={cn(CAL, off(d), "cursor-pointer")}
                        onClick={() => actions.toggleLeave(dr.id, iso(d))}
                      >
                        {lv ? (
                          <Pill tone="warning">{lv.kind}</Pill>
                        ) : dd.n ? (
                          <>
                            <Mono>
                              {fmtH(
                                Math.min(
                                  ...q
                                    .dayTrips(d, (f) => f.driverId === dr.id)
                                    .map((f) => f.start || 6),
                                ),
                              )}
                              –{fmtH(dd.end)}
                            </Mono>
                            <Small>
                              {dd.n} forduló · vez. {fmt(dd.drive, 1)} h
                            </Small>
                          </>
                        ) : (
                          <Small>—</Small>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell numeric className={CAL}>
                    <Pill tone={w > 48 ? "warning" : "neutral"}>
                      {fmt(w, 1)} / 56 h
                    </Pill>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
      <Panel className="mt-3.5">
        <h2>Megrendelések a héten</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nap</TableHead>
              <TableHead>Megrendelés</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead numeric>Fuvar</TableHead>
              <TableHead numeric>Tonna</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderRows.length ? (
              orderRows
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-xs text-muted-foreground"
                >
                  Nincs fuvar a héten.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

function ListTab() {
  const { S, q, actions } = useDemo();
  const ts = [...S.transports]
    .filter((f) => f.status !== "Törölve")
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || (a.start || 0) - (b.start || 0),
    );
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fuvar</TableHead>
            <TableHead>Nap · idő</TableHead>
            <TableHead>Ügyfél · termék</TableHead>
            <TableHead numeric>t</TableHead>
            <TableHead>Jármű</TableHead>
            <TableHead>Sofőr</TableHead>
            <TableHead>Figyelm.</TableHead>
            <TableHead>Állapot</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ts.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono">{f.id}</TableCell>
              <TableCell>
                {ds(f.date)}
                <Small className="font-mono">
                  {f.start != null
                    ? fmtH(f.start) + "–" + fmtH(f.start + (f.dur ?? 0))
                    : "—"}
                </Small>
              </TableCell>
              <TableCell>
                {f.clientName}
                <Small>{q.P(f.pid).name}</Small>
              </TableCell>
              <TableCell numeric>{fmt(f.planned, 1)}</TableCell>
              <TableCell>
                {f.status === "Lezárva" ? (
                  f.truck
                ) : (
                  <Sel
                    aria-label="Jármű"
                    defaultValue={f.truck ?? undefined}
                    onCommit={(el) => actions.listTruck(f.id, el.value)}
                  >
                    {S.trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id}
                      </option>
                    ))}
                  </Sel>
                )}
              </TableCell>
              <TableCell>
                {f.status === "Lezárva" ? (
                  f.driver
                ) : (
                  <Sel
                    aria-label="Sofőr"
                    defaultValue={f.driverId ?? undefined}
                    onCommit={(el) => actions.listDriver(f.id, el.value)}
                  >
                    {S.drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Sel>
                )}
              </TableCell>
              <TableCell>
                {f.warn && f.warn.length ? (
                  <Pill tone="destructive" title={f.warn.join("; ")}>
                    {f.warn.length}
                  </Pill>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusPill status={f.status} />
              </TableCell>
              <TableCell>
                <Row className="flex-nowrap">
                  {f.status === "Javasolt" ? (
                    <Btn sm kind="pri" onClick={() => actions.dispAccept(f.id)}>
                      Elfogad
                    </Btn>
                  ) : null}
                  <Btn sm onClick={() => actions.dispGoto(iso(f.date), f.id)}>
                    Napi nézet
                  </Btn>
                </Row>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

const WIDTH = { txt: "w-42.5", date: "w-35" } as const;

function ResTab() {
  const demo = useDemo();
  const { S, q, actions, view } = demo;
  const date = view.DISP.date;
  const soon = iso(addDays(demo.TODAY, 30));
  const cell = (o: Truck | Driver, p: ParamDef, kind: "t" | "d") => {
    const [k, l, ty, opts] = p;
    const v =
      k === "pos"
        ? q.telemPos(o as Truck)
        : k === "ftkm"
          ? ft(q.truckFtKm(o as Truck)) + "/km"
          : k === "dayDrive"
            ? fmt(q.driverDay(o.id, date).drive, 1) +
              " / 9 h · heti " +
              fmt(
                q.weekDrive(o as Driver, date) + q.driverDay(o.id, date).drive,
                1,
              ) +
              " h"
            : k === "cont"
              ? q.driverDay(o.id, date).drive > 4.5
                ? "szünet beiktatva"
                : "rendben"
              : k === "otUsed"
                ? `${(o as Driver).ot} / ${(o as Driver).otCap} h`
                : (o as object as Record<string, unknown>)[k];
    const sv = v == null ? "" : String(v);
    if (ty === "ro")
      return (
        <TableCell key={k} className="whitespace-nowrap">
          <Small className="inline">{sv}</Small>
        </TableCell>
      );
    if (ty === "sel")
      return (
        <TableCell key={k} className="whitespace-nowrap">
          <Sel
            aria-label={l}
            defaultValue={opts?.includes(sv) ? sv : undefined}
            onCommit={(el) =>
              actions.setResource(kind, o.id, k, el.value, false)
            }
          >
            {opts?.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Sel>
        </TableCell>
      );
    const type = ty === "num" ? "number" : ty === "date" ? "date" : "text";
    return (
      <TableCell key={k} className="whitespace-nowrap">
        <Inp
          type={type}
          aria-label={l}
          defaultValue={sv}
          className={cn(
            ty === "txt" ? WIDTH.txt : ty === "date" ? WIDTH.date : "w-20",
            ty === "date" && sv < soon && "border-warning bg-warning-soft",
          )}
          onCommit={(el) =>
            actions.setResource(kind, o.id, k, el.value, type === "number")
          }
        />
      </TableCell>
    );
  };
  const head = (p: ParamDef) => (
    <TableHead
      key={p[0]}
      title={`Forrás: ${p[4]}`}
      className={cn(
        "min-w-27.5 align-bottom text-label whitespace-normal",
        (p[2] === "ro" || /automatikus/.test(p[4])) && "text-primary",
      )}
    >
      {p[1]}
    </TableHead>
  );
  return (
    <>
      <Panel>
        <Spread>
          <h2>Járművek — 15 paraméter</h2>
          <Row>
            <Btn sm onClick={actions.itsyncClick}>
              iTrack szinkron most
            </Btn>
            <Btn sm onClick={actions.addTruck}>
              Új jármű
            </Btn>
          </Row>
        </Spread>
        <p className="my-3 text-xs text-muted-foreground">
          A zöld fejlécű oszlopokat a rendszer tartja karban (iTrack, tachográf,
          költségmodell); a többit a diszpécser állítja. 30 napon belül lejáró
          dátum narancs.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-27.5 align-bottom text-label whitespace-normal">
                Rendszám
              </TableHead>
              {VPARAM.map(head)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.trucks.map((tr) => (
              <TableRow key={tr.id}>
                <TableCell className="whitespace-nowrap">
                  <b>{tr.id}</b>
                  <Small>{tr.name}</Small>
                </TableCell>
                {VPARAM.map((p) => cell(tr, p, "t"))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel className="mt-3.5">
        <Spread>
          <h2>Sofőrök — 15 paraméter</h2>
          <Btn sm onClick={actions.addDriver}>
            Új sofőr
          </Btn>
        </Spread>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-27.5 align-bottom text-label whitespace-normal">
                Név
              </TableHead>
              {DPARAM.map(head)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.drivers.map((dr) => (
              <TableRow key={dr.id}>
                <TableCell className="whitespace-nowrap">
                  <b>{dr.name}</b>
                  <Small>{dr.home}</Small>
                </TableCell>
                {DPARAM.map((p) => cell(dr, p, "d"))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const UL = "my-3 list-disc pl-10 text-xs text-muted-foreground";

function RulesTab() {
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Kemény korlátok (kizáró)</h2>
        <ul className={UL}>
          <li>
            Teherbírás ≥ fuvarmennyiség; cím szerinti össztömeg-korlát (pl.
            Siófok 32 t)
          </li>
          <li>
            Behajtási engedély és EURO-osztály a zónához (Budapest 12 t felett
            P+, EURO VI)
          </li>
          <li>Billentés iránya a lerakóhoz</li>
          <li>Érvényes műszaki vizsga, nincs aznapi munkalap (szerviz)</li>
          <li>Vasárnapi kamionstop 7,5 t felett</li>
          <li>Jogosítvány: nyerges és pótkocsis szerelvényhez CE</li>
          <li>Szabadság, betegség, elérhetőség (pl. csak délelőtt)</li>
          <li>Érvényes sofőrkártya és GKI</li>
          <li>
            Napi vezetési idő max. 9 h (EU 561/2006), 4,5 h után 45 perc szünet
            automatikusan
          </li>
          <li>Heti 56 h, kéthetes 90 h vezetési idő</li>
          <li>Napi munkaidő-keret (sofőrönként, max. 12 h)</li>
          <li>Ügyfél-tiltás</li>
        </ul>
      </Panel>
      <Panel>
        <h2>Költség-pontszám (minél kisebb, annál jobb)</h2>
        <ul className={UL}>
          <li>
            Fuvar-önköltség: oda-vissza km × a jármű Ft/km-e (fogyasztás és
            EURO-osztály szerint)
          </li>
          <li>Kihasználatlan teherbírás büntetése</li>
          <li>Túlóra-pótlék (8 h felett 50%) és havi túlórakeret</li>
          <li>Üresjárat, ha a jármű a másik bányában áll</li>
          <li>Alacsony üzemanyagszint (tankolási idő)</li>
          <li>Gyakorlatlanság a járműtípuson</li>
          <li>Ügyfél-preferencia, helyismeret (bónusz)</li>
          <li>Vezetési stílus (iTrack eco-pont)</li>
          <li>Terhelés kiegyenlítése a sofőrök között</li>
        </ul>
        <p className="my-3 text-xs text-muted-foreground">
          A pontszám 100 = a nap legolcsóbb szabályos párosa. A diszpécser
          bármelyik javaslatot választhatja, vagy kézzel felülbírálhat; a
          felülbírált szabály a naplóba kerül.
        </p>
      </Panel>
    </Grid>
  );
}

function CapTab() {
  const { S, q, actions, view } = useDemo();
  const CAP = view.CAP;
  const o = CAP.oid ? S.orders.find((x) => x.id === CAP.oid) : undefined;
  const zip = o ? o.zip : CAP.zip,
    pid = o ? o.lines[0].pid : CAP.pid;
  const plan = q.capacityPlan(+CAP.target, zip, pid, CAP.date);
  const tot = plan.rows.reduce((a, r) => a + r.trips, 0);
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Mennyi autó kell?</h2>
        <p className="my-3 text-xs text-muted-foreground">
          „Holnap X tonna ide” → hány autó, hány forduló, melyik sofőr. A
          számítás a jármű-teherbírást, a cím korlátozásait, a ciklusidőt
          (rakodás + út + lerakás + vissza), a napi 9 órás vezetési időt és az
          aznap már kiosztott fuvarokat veszi figyelembe.
        </p>
        <Grid cols={2} className="mt-2.5">
          <Field label="Megrendelés (opcionális)">
            <Sel
              defaultValue={CAP.oid ?? ""}
              onCommit={(el) => actions.setCap("oid", el.value)}
            >
              <option value="">— szabad számítás —</option>
              {S.orders.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} · {x.clientName}
                </option>
              ))}
            </Sel>
          </Field>
          <Field label="Nap">
            <Inp
              type="date"
              defaultValue={CAP.date}
              onCommit={(el) => actions.setCap("date", el.value)}
            />
          </Field>
          <Field label="Céltonna (t)">
            <Inp
              type="number"
              defaultValue={CAP.target}
              onCommit={(el) => actions.setCap("target", el.value)}
            />
          </Field>
          {o ? (
            <Small>
              Cím: {o.zip} {o.city || ""} · {q.P(pid).name}
            </Small>
          ) : (
            <Field label="Irányítószám">
              <Inp
                defaultValue={CAP.zip}
                onCommit={(el) => actions.setCap("zip", el.value)}
              />
            </Field>
          )}
        </Grid>
      </Panel>
      <Panel>
        <h2>Eredmény</h2>
        <Grid cols={2}>
          <Kpi
            label="Autó"
            value={plan.rows.length}
            detail={`${plan.trucks} jármű alkalmas a címre`}
          />
          <Kpi
            label="Forduló"
            value={tot}
            detail={`${plan.km} km, ciklus ${fmt(plan.cyc, 1)} h`}
          />
        </Grid>
        {plan.left > 0 ? (
          <Alert lvl="bad">
            {tn(plan.left)} nem fér bele a napba — két napra kell bontani, vagy
            alvállalkozót bevonni.
          </Alert>
        ) : (
          <Alert lvl="ok">A céltonna egy nap alatt teljesíthető.</Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jármű</TableHead>
              <TableHead>Sofőr</TableHead>
              <TableHead numeric>Forduló</TableHead>
              <TableHead numeric>Tonna</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.rows.map((r) => (
              <TableRow key={r.t.id}>
                <TableCell>
                  {r.t.id}
                  <Small>
                    {r.t.type}, {r.t.cap} t
                  </Small>
                </TableCell>
                <TableCell>{r.d.name}</TableCell>
                <TableCell numeric>{r.trips}</TableCell>
                <TableCell numeric>{fmt(r.tons)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {o ? (
          <Row className="mt-2">
            <Btn kind="pri" onClick={actions.capMake}>
              Fuvarjavaslatok létrehozása erre a napra
            </Btn>
          </Row>
        ) : null}
      </Panel>
    </Grid>
  );
}
