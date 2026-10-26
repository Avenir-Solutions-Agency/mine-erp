"use client";

import type { ReactNode } from "react";
import { fmt, iso } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
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
  Btn,
  formValue,
  Grid,
  Head,
  Inp,
  Panel,
  Row,
  Small,
  Spread,
} from "@/prototype/ui";

// V.scale: ANPR camera → plate → today's transport → net weight → delivery note.
export function ScaleScreen() {
  const demo = useDemo();
  const { S, view, actions, TODAY } = demo;
  const avg = S.loadWait.length
    ? S.loadWait.reduce((a, x) => a + x.min, 0) / S.loadWait.length
    : 0;
  return (
    <>
      <Head
        title="Mérleg"
        sub="Kamera → rendszám → jármű → mai elfogadott fuvar → mérlegelés → nettó tömeg → szállítólevél. A tonnát senki nem gépeli be; ember csak eltérésnél (ismeretlen rendszám, nincs fuvar, túltöltés, hiányzó EKÁER) nyúl hozzá."
      />
      <Grid cols={4}>
        <Kpi
          label="Ma mérlegelve"
          value={S.anpr.filter((a) => a.done).length}
        />
        <Kpi
          label="Átlagos várakozás a rakodásnál"
          value={`${fmt(avg, 0)} perc`}
        />
        <Kpi
          label="Mai fuvar mérlegre vár"
          value={
            S.transports.filter(
              (f) => iso(f.date) === iso(TODAY) && f.status === "Tervezett",
            ).length
          }
        />
        <Kpi label="Kivétel ma" value={S.anpr.filter((a) => a.exc).length} />
      </Grid>
      <Panel className="mt-3.5">
        <Spread>
          <h2>Hídmérleg — Polgárdi</h2>
          <Btn kind="ai" onClick={() => actions.scaleArrive()}>
            Jármű érkezik (szimuláció)
          </Btn>
        </Spread>
        {view.SCALE.cur ? (
          <ScaleCard />
        ) : (
          <Small className="my-3">
            Várakozás járműre. A kamera a kapunál olvassa a rendszámot.
          </Small>
        )}
      </Panel>
      <Panel className="mt-3.5">
        <h2>Mai mérlegelések</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Idő</TableHead>
              <TableHead>Rendszám</TableHead>
              <TableHead>Felismerés</TableHead>
              <TableHead>Párosítás</TableHead>
              <TableHead numeric>Nettó</TableHead>
              <TableHead numeric>Várakozás</TableHead>
              <TableHead>Eredmény</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.anpr.length ? (
              S.anpr.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.t}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{a.plate}</TableCell>
                  <TableCell>{a.conf}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.match || "—"}
                  </TableCell>
                  <TableCell numeric>
                    {a.net ? fmt(a.net, 2) + " t" : "—"}
                  </TableCell>
                  <TableCell numeric>
                    {a.wait ? a.wait + " perc" : "—"}
                  </TableCell>
                  <TableCell>
                    {a.exc ? (
                      <Pill tone="warning">{a.exc}</Pill>
                    ) : a.done ? (
                      <Pill tone="success">szállítólevél</Pill>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-xs text-muted-foreground"
                >
                  Még nincs.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

function ScaleCard() {
  const { S, q, view, actions } = useDemo();
  const c = view.SCALE.cur!;
  if (c.kind === "own") {
    const f = S.transports.find((x) => x.id === c.fid)!;
    const t = q.TR(f.truck)!;
    const net = +(c.gross - t.tare!).toFixed(2);
    const blocks: string[] = [];
    if (f.ekaer.required && !f.ekaer.number)
      blocks.push("EKÁER-szám hiányzik — az EKÁER-admin jóváhagyására vár");
    if (net > t.cap * 1.02)
      blocks.push(
        `túltöltés: ${fmt(net, 2)} t > ${t.cap} t teherbírás — vissza a rakodóhoz`,
      );
    const rows: [string, ReactNode][] = [
      [
        "Felismert rendszám",
        <span key="p">
          <b className="font-mono text-xs">{c.plate}</b>{" "}
          <Pill tone="success">{c.conf}%</Pill>
        </span>,
      ],
      ["Jármű", `${t.name} · ${t.type}`],
      [
        "Mai fuvar",
        <span key="f" className="font-mono text-xs">
          {f.id}
        </span>,
      ],
      ["Vevő · termék", `${f.clientName} · ${q.P(f.pid).name}`],
      ["Sofőr", f.driver],
      [
        "EKÁER",
        <span key="e" className="font-mono text-xs">
          {f.ekaer.number || (f.ekaer.required ? "—" : "nem köteles")}
        </span>,
      ],
    ];
    return (
      <Grid cols={2}>
        <div>
          <Table>
            <TableBody>
              {rows.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <Kpi
            label="Bruttó (mérleg)"
            value={`${fmt(c.gross, 2)} t`}
            detail={
              <>
                tára {fmt(t.tare, 1)} t (járműtörzs) ·{" "}
                <b>nettó {fmt(net, 2)} t</b> · terv {fmt(f.planned, 1)} t
              </>
            }
          />
          <Small className="mt-1.5">
            Várakozás a rakodásnál: {c.wait} perc (kapu → mérleg)
          </Small>
          {blocks.map((b) => (
            <Alert key={b} lvl="bad">
              {b}
            </Alert>
          ))}
          <Row className="mt-2">
            <Btn
              kind="pri"
              disabled={!!blocks.length}
              onClick={() => actions.scaleOk()}
            >
              Mérlegjegy → szállítólevél
            </Btn>
            {blocks.length ? (
              <Btn onClick={() => actions.scaleNext()}>
                Félreállít, következő
              </Btn>
            ) : null}
          </Row>
        </div>
      </Grid>
    );
  }
  if (c.kind === "waste") {
    const pt = S.wpart.find((p) => p.plates.includes(c.plate))!;
    return (
      <>
        <p className="my-3 text-control">
          Felismert rendszám: <b className="font-mono text-xs">{c.plate}</b> →
          hulladék-beszállító: <b>{pt.name}</b>. Bruttó {fmt(c.gross, 2)} t.
        </p>
        <Row>
          <Btn kind="pri" onClick={() => actions.scaleToWaste()}>
            Hulladék-beszállítás rögzítése
          </Btn>
        </Row>
      </>
    );
  }
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Alert lvl="warn">
        Ismeretlen rendszám: <b className="font-mono text-xs">{c.plate}</b> (
        {c.conf}% bizonyosság). Nincs a járműtörzsben és nincs mai fuvarja.
      </Alert>
      <Row>
        <Inp
          name="sc-plate"
          placeholder="Rendszám javítása"
          aria-label="Rendszám"
        />
        <Btn
          onClick={(e) =>
            actions.scaleFix(formValue(e.currentTarget.form, "sc-plate"))
          }
        >
          Javítás
        </Btn>
        <Btn onClick={() => actions.scaleNext()}>Elküld (nincs fuvarja)</Btn>
      </Row>
    </form>
  );
}
