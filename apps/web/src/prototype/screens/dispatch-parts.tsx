"use client";

import { useRef, useState, type PointerEvent } from "react";
import { fmt, fmtH, ft, iso, pct, tn } from "@mine-erp/domain/demo";
import type { Transport } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
import { Pill } from "@/components/ui/pill";
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
  Btn,
  Field,
  formValue,
  Grid,
  Inp,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
} from "@/prototype/ui";

/** Demo clientColor(): var(--c{index % 7}), unknown clients use c6. */
export function useClientColor() {
  const { S } = useDemo();
  return (name: string) => {
    const i = S.clients.findIndex((c) => c.name === name);
    return `var(--chart-${((i < 0 ? 6 : i) % 7) + 1})`;
  };
}

const W = 900,
  LW = 150,
  H0 = 26,
  RH = 34;
const x = (h: number) => LW + ((W - LW - 10) * (h - 5)) / (19 - 5);

interface Drag {
  f: Transport;
  p0: [number, number];
  moved: boolean;
}

/** timeline() + bindTimeline(): rows of trucks or drivers, trip blocks draggable to a row and hour. */
export function Timeline({ date }: { date: Date }) {
  const demo = useDemo();
  const { S, q, actions, view } = demo;
  const DISP = view.DISP;
  const clientColor = useClientColor();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [off, setOff] = useState<{ id: string; dx: number; dy: number }>();

  const rows =
    DISP.rows === "truck"
      ? S.trucks.map((t) => ({
          k: t.id,
          l: t.id,
          s: t.type,
          m: (f: Transport) => f.truck === t.id,
          off: false,
        }))
      : S.drivers.map((d) => {
          const lv = q.isLeave(d, date);
          return {
            k: d.id,
            l: d.name,
            s: lv ? lv.kind : d.avail,
            m: (f: Transport) => f.driverId === d.id,
            off: !!lv || d.avail === "Betegszabadság",
          };
        });
  const H = H0 + rows.length * RH + 6;

  const pt = (e: PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return [
      ((e.clientX - r.left) * vb.width) / r.width,
      ((e.clientY - r.top) * vb.height) / r.height,
    ];
  };
  const down = (e: PointerEvent, f: Transport) => {
    if (f.status === "Lezárva") return;
    drag.current = { f, p0: pt(e), moved: false };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = pt(e);
    const dx = p[0] - d.p0[0],
      dy = p[1] - d.p0[1];
    // Capture only once it is a drag, so a plain click still reaches the trip's onClick.
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    if (d.moved) setOff({ id: d.f.id, dx, dy });
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (!d.moved) return;
    const p = pt(e);
    const row = Math.floor((p[1] - H0) / RH);
    const hour =
      Math.round(
        ((d.f.start || 6) + (p[0] - d.p0[0]) / ((W - LW - 10) / 14)) * 4,
      ) / 4;
    const key = rows[Math.max(0, Math.min(rows.length - 1, row))].k;
    setOff(undefined);
    actions.dragTrip(d.f.id, key, hour);
  };

  const hours = Array.from({ length: 15 }, (_, i) => i + 5);
  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Napi fuvarterv idővonal — a blokkok húzhatók"
        className="min-w-180 touch-none fill-muted-foreground font-mono"
        fontSize={10}
        onPointerMove={move}
        onPointerUp={up}
      >
        <g className="stroke-border">
          {hours.map((h) => (
            <g key={h}>
              <line x1={x(h)} x2={x(h)} y1={18} y2={H} />
              {h % 2 ? null : (
                <text
                  x={x(h)}
                  y={13}
                  textAnchor="middle"
                  className="stroke-none"
                >
                  {h}:00
                </text>
              )}
            </g>
          ))}
        </g>
        <rect
          x={x(18)}
          y={18}
          width={x(19) - x(18)}
          height={H - 18}
          fill="var(--destructive)"
          opacity={0.06}
        />
        {rows.map((r, i) => {
          const y = H0 + i * RH;
          const ts = q.dayTrips(date, r.m);
          const work = ts.reduce((a, f) => a + (f.dur || 0), 0);
          return (
            <g key={r.k}>
              <text
                x={6}
                y={y + 14}
                fontSize={12}
                className="fill-foreground font-sans"
              >
                {r.l}
              </text>
              <text x={6} y={y + 27} fontSize={9.5}>
                {r.s} · {pct(work / 12)}
              </text>
              {r.off ? (
                <>
                  <rect
                    x={LW}
                    y={y + 3}
                    width={W - LW - 10}
                    height={RH - 8}
                    fill="var(--muted)"
                  />
                  <text x={LW + 8} y={y + 20}>
                    nem elérhető
                  </text>
                </>
              ) : null}
              {ts.map((f) => {
                if (f.start == null) return null;
                const x0 = x(f.start),
                  w = x(f.start + (f.dur ?? 0)) - x(f.start) - 1;
                const conflict = !!f.warn?.length;
                const acc = f.status !== "Javasolt";
                const sel = DISP.sel === f.id;
                const o = off?.id === f.id ? off : undefined;
                return (
                  <g
                    key={f.id}
                    className="cursor-pointer"
                    transform={o ? `translate(${o.dx},${o.dy})` : undefined}
                    onPointerDown={(e) => down(e, f)}
                    onClick={() => actions.dispSelect(f.id)}
                  >
                    <rect
                      x={x0}
                      y={y + 3}
                      width={Math.max(6, w)}
                      height={RH - 8}
                      rx={3}
                      fill={clientColor(f.clientName)}
                      opacity={acc ? 1 : 0.55}
                      stroke={
                        conflict
                          ? "var(--destructive)"
                          : sel
                            ? "var(--foreground)"
                            : "none"
                      }
                      strokeWidth={conflict || sel ? 2.5 : 0}
                      strokeDasharray={acc ? undefined : "4 3"}
                    >
                      <title>
                        {`${f.id} · ${f.clientName} · ${q.P(f.pid).name} ${fmt(f.planned, 1)} t · ${fmtH(f.start || 6)}–${fmtH((f.start || 6) + (f.dur || 1))}${conflict ? " · ⚠ " + f.warn!.join("; ") : ""}`}
                      </title>
                    </rect>
                    {w > 58 ? (
                      <text
                        x={x0 + 4}
                        y={y + (RH - 8) / 2 + 7}
                        className="fill-primary-foreground"
                      >
                        {f.id.slice(7)} {fmt(f.planned, 0)}t
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** tripPanel(f): details, top 3 suggestions, rejection reasons and the manual edit form. */
export function TripPanel({ f }: { f: Transport | undefined }) {
  const demo = useDemo();
  const { S, q, actions } = demo;
  if (!f)
    return (
      <Panel>
        <h2>Fuvar részletei</h2>
        <p className="my-3 text-xs text-muted-foreground">
          Válasszon fuvart az idővonalon vagy a listában. A rendszer megmutatja
          a 3 legjobb jármű–sofőr párost és azt is, miért zárt ki másokat.
        </p>
      </Panel>
    );
  const o = S.orders.find((x) => x.id === f.order)!;
  const s = q.suggest(f);
  const rules = q.addrRules(o);
  const locked = f.status === "Lezárva" || f.status === "Úton";
  const ev =
    f.truck && f.driverId
      ? q.evaluate(f, q.TR(f.truck), q.DR(f.driverId))
      : null;
  const reasons: Record<string, number> = {};
  s.rejected.forEach((r) =>
    r.hard.forEach((h) => {
      const k = h.replace(/^[^:]+: /, "");
      reasons[k] = (reasons[k] || 0) + 1;
    }),
  );
  const start = f.start ?? 0;
  return (
    <Panel>
      <Spread>
        <h2>{f.id}</h2>
        <StatusPill status={f.status} />
      </Spread>
      <Small>
        {f.clientName} · {q.P(f.pid).name} {tn(f.planned)} · {o.zip}{" "}
        {o.city || ""} · {f.km || q.distKm(o.zip)} km · depó:{" "}
        {q.D(f.depot).name}
      </Small>
      {rules.map((r, i) => (
        <Alert key={i} lvl="warn">
          {r.note}
        </Alert>
      ))}
      {ev ? (
        <Alert lvl={ev.hard.length ? "bad" : "ok"}>
          Most:{" "}
          <b>
            {f.truck} · {f.driver}
          </b>{" "}
          {fmtH(start)}–{fmtH(start + (f.dur ?? 0))}, {ft(ev.cost)} becsült
          költség
          {ev.hard.length ? (
            <div className="text-destructive">{ev.hard.join(" · ")}</div>
          ) : null}
          {ev.soft.length ? <Small>{ev.soft.join(" · ")}</Small> : null}
        </Alert>
      ) : null}
      {locked ? null : (
        <>
          <h3 className="mt-2.5">
            Javaslatok ({s.okCount} szabályos páros a {s.total}-ból)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Jármű · sofőr</TableHead>
                <TableHead>Idő</TableHead>
                <TableHead numeric>Költség</TableHead>
                <TableHead numeric>Pont</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.top.length ? (
                s.top.map((x, i) => (
                  <TableRow key={`${x.t.id}-${x.d.id}`}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <b>{x.t.id}</b> · {x.d.name}
                      <Small>{x.soft.join(" · ") || "nincs megjegyzés"}</Small>
                    </TableCell>
                    <TableCell className="font-mono">
                      {fmtH(x.start)}–{fmtH(x.end)}
                    </TableCell>
                    <TableCell numeric>{ft(x.cost)}</TableCell>
                    <TableCell numeric>
                      <Pill tone={i === 0 ? "success" : "neutral"}>
                        {x.score}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <Btn
                        sm
                        kind={i === 0 ? "pri" : "default"}
                        onClick={() => actions.dispPick(f.id, x.t.id, x.d.id)}
                      >
                        Kiválaszt
                      </Btn>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-destructive">
                    Nincs szabályos páros ezen a napon. Tegye át másik napra.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <details className="mt-1.5">
            <summary className="text-xs text-muted-foreground">
              Kizárási okok ({s.rejected.length} páros)
            </summary>
            <Small>
              {Object.entries(reasons)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k}>
                    {k} — {v}
                  </div>
                ))}
            </Small>
          </details>
          <h3 className="mt-2.5">Kézi módosítás</h3>
          <form onSubmit={(e) => e.preventDefault()}>
            <Grid cols={2}>
              <Field label="Nap">
                <Inp type="date" name="dm-date" defaultValue={iso(f.date)} />
              </Field>
              <Field label="Indulás">
                <Inp
                  type="time"
                  name="dm-start"
                  defaultValue={fmtH(f.start || 6)}
                />
              </Field>
              <Field label="Jármű">
                <Sel name="dm-t" defaultValue={f.truck ?? undefined}>
                  {S.trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} · {t.type} · {t.cap} t
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label="Sofőr">
                <Sel name="dm-d" defaultValue={f.driverId ?? undefined}>
                  {S.drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.lic})
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label="Mennyiség (t)">
                <Inp
                  type="number"
                  step="0.5"
                  name="dm-q"
                  defaultValue={f.planned}
                />
              </Field>
              <Row className="self-end">
                <Btn
                  onClick={(e) => {
                    const form = e.currentTarget.form;
                    actions.dispSave(f.id, {
                      date: formValue(form, "dm-date"),
                      start: formValue(form, "dm-start"),
                      truck: formValue(form, "dm-t"),
                      driver: formValue(form, "dm-d"),
                      qty: formValue(form, "dm-q"),
                    });
                  }}
                >
                  Módosítás mentése
                </Btn>
              </Row>
            </Grid>
          </form>
          <Row className="mt-2.5">
            {f.status === "Javasolt" ? (
              <Btn kind="pri" onClick={() => actions.dispAccept(f.id)}>
                Elfogadom
              </Btn>
            ) : null}
            <Btn kind="bad" sm onClick={() => actions.cancelTransport(f.id)}>
              Fuvar törlése
            </Btn>
          </Row>
        </>
      )}
    </Panel>
  );
}
