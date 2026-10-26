"use client";

import { useRef, useState } from "react";
import type { Transport } from "@mine-erp/domain/demo";
import { ds, fmt, ft, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill, pillTone } from "@/prototype/status-pill";
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
  AiBox,
  Btn,
  Field,
  formValue,
  Grid,
  Head,
  Inp,
  Json,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";

// V.transport with the round-5 EKÁER admin approval box on top.
export function TransportScreen() {
  const demo = useDemo();
  const { S, q, ui } = demo;
  const cur = S.transports.find((f) => f.id === ui.sel.f);
  return (
    <>
      <Head
        title="Fuvarok és EKÁER"
        sub="Fuvaronként automatikus EKÁER-döntés indoklással. Bejelentés nélkül a fuvar nem indul; a mérlegjegy lezárja a fuvart, levonja a készletet és kiállítja a szállítólevelet."
      />
      <div>
        <EkaerApproval />
      </div>
      <Grid cols={cur ? 2 : 1}>
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fuvar</TableHead>
                <TableHead>Nap · autó</TableHead>
                <TableHead>Ügyfél · termék</TableHead>
                <TableHead numeric>Terv / nettó</TableHead>
                <TableHead>EKÁER</TableHead>
                <TableHead>Állapot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.transports.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer"
                  onClick={() => demo.actions.selectTransport(f.id)}
                >
                  <TableCell className="font-mono text-xs">{f.id}</TableCell>
                  <TableCell>
                    {ds(f.date)}
                    <Small>
                      {f.truck || "—"} · {f.driver || "kiosztásra vár"}
                    </Small>
                  </TableCell>
                  <TableCell>
                    {f.clientName}
                    <Small>{q.P(f.pid).name}</Small>
                  </TableCell>
                  <TableCell numeric>
                    {fmt(f.planned, 1)} / {f.net != null ? fmt(f.net, 1) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={f.ekaer.status} />
                    {f.ekaer.number ? (
                      <Small className="font-mono">{f.ekaer.number}</Small>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={f.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        {cur ? (
          <Stack>
            <TrDetail f={cur} />
          </Stack>
        ) : null}
      </Grid>
    </>
  );
}

function EkaerApproval() {
  const { S, q, actions } = useDemo();
  const form = useRef<HTMLFormElement>(null);
  const prep = S.transports
    .filter(
      (f) =>
        f.ekaer &&
        f.ekaer.prepared &&
        !f.ekaer.number &&
        f.status !== "Törölve",
    )
    .sort((a, b) => +a.date - +b.date);
  const boxes = () =>
    Array.from(
      form.current?.querySelectorAll<HTMLInputElement>("input.ekchk") ?? [],
    );
  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()}>
      <Panel className="mb-3.5 border-ai">
        <Spread>
          <h2>EKÁER-bejelentések jóváhagyásra ({prep.length})</h2>
          <Row>
            <Btn sm onClick={() => boxes().forEach((c) => (c.checked = true))}>
              Mind kijelöl
            </Btn>
            <Btn
              kind="pri"
              disabled={!prep.length}
              onClick={() =>
                actions.ekaerSendSelected(
                  boxes()
                    .filter((c) => c.checked)
                    .map((c) => c.value),
                )
              }
            >
              Kijelöltek beküldése a NAV-nak
            </Btn>
          </Row>
        </Spread>
        <Small className="my-3">
          Az EKÁER-ügyintéző ügynök előkészítette és ellenőrizte a
          bejelentéseket; a beküldés az EKÁER-admin döntése (a brief 17. pontja
          szerint).
        </Small>
        {prep.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Fuvar</TableHead>
                <TableHead>Nap</TableHead>
                <TableHead>Vevő · termék</TableHead>
                <TableHead numeric>t</TableHead>
                <TableHead>Rendszám</TableHead>
                <TableHead numeric>Érték</TableHead>
                <TableHead>Indoklás</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prep.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="ekchk"
                      value={f.id}
                      aria-label={`${f.id} kijelölése`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.id}</TableCell>
                  <TableCell>{ds(f.date)}</TableCell>
                  <TableCell>
                    {f.clientName}
                    <Small>{q.P(f.pid).name}</Small>
                  </TableCell>
                  <TableCell numeric>{fmt(f.planned, 1)}</TableCell>
                  <TableCell>{f.truck || "—"}</TableCell>
                  <TableCell numeric>{ft(f.ekaer.value)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.ekaer.reasons.slice(-1)[0] || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Small className="my-3">Nincs beküldésre váró bejelentés.</Small>
        )}
      </Panel>
    </form>
  );
}

function TrDetail({ f }: { f: Transport }) {
  const { S, q, actions } = useDemo();
  const o = S.orders.find((x) => x.id === f.order)!;
  // The demo pre-fills the weight with the plan ± 0.5 t on every render.
  const [w] = useState(() =>
    fmt(f.planned + (Math.random() - 0.5), 2)
      .replace(",", ".")
      .replace(/\s/g, ""),
  );
  return (
    <Panel>
      <Spread>
        <h2>{f.id}</h2>
        <StatusPill status={f.status} />
      </Spread>
      <Small>
        {f.clientName} · {o.zip} {o.city || ""} {o.addr || ""} · {f.truck} (
        {f.driver}) · depó: {q.D(f.depot).name}
      </Small>
      <AiBox who="EKÁER-ügyintéző · döntés">
        <p className="my-1">
          <b>
            {f.ekaer.required ? "Bejelentésköteles" : "Nem bejelentésköteles"}
          </b>
        </p>
        <ul className="m-0 list-disc pl-4.5">
          {f.ekaer.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {f.ekaer.number ? (
          <p className="mt-1.5 font-mono text-xs">
            EKÁER-szám: {f.ekaer.number} · {ds(f.ekaer.at!)} · {f.ekaer.status}
          </p>
        ) : null}
        {S.jobs
          .filter((j) => j.ref === f.id)
          .map((j) => (
            <Small key={j.id}>
              {j.system} · {j.op} —{" "}
              <Pill tone={pillTone(j.status === "Sikeres" ? "ok" : "warn")}>
                {j.status}
              </Pill>
            </Small>
          ))}
        {f.ekaer.required && !f.ekaer.number ? (
          <Row className="mt-2">
            <Btn kind="pri" onClick={() => actions.ekaerClick(f.id)}>
              {f.ekaer.job ? "Bejelentés újraküldése" : "Bejelentés beküldése"}
            </Btn>
          </Row>
        ) : null}
        {f.ekaer.required ? (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground">
              Beküldött adatok (minta)
            </summary>
            <Json value={q.ekaerPayload(f)} />
          </details>
        ) : null}
      </AiBox>
      {f.status !== "Lezárva" ? (
        <Row className="mt-2.5">
          <Field label="Autócsere">
            <Sel
              defaultValue={f.truck ?? undefined}
              onCommit={(el) => actions.swapTruck(f.id, el.value)}
            >
              {S.trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.type}
                </option>
              ))}
            </Sel>
          </Field>
          <Btn
            kind="bad"
            className="self-end"
            onClick={() => actions.cancelTransport(f.id)}
          >
            Fuvar elmarad
          </Btn>
        </Row>
      ) : null}
      {f.status !== "Lezárva" ? (
        <Panel className="mt-2.5">
          <form onSubmit={(e) => e.preventDefault()}>
            <h3>Mérlegelés</h3>
            <Small>
              Élesben a hídmérleg szoftveréből jön a nettó tömeg és a mérlegjegy
              PDF; itt kézzel szimulálható.
            </Small>
            <Row>
              <Field label="Állásidő (perc)">
                <Inp
                  name={`wt-${f.id}`}
                  type="number"
                  defaultValue="0"
                  className="w-22.5"
                />
              </Field>
              <Field label="Nettó tömeg (t)">
                <Inp
                  name={`w-${f.id}`}
                  type="number"
                  step="0.01"
                  defaultValue={w}
                />
              </Field>
              <Btn
                kind="pri"
                className="self-end"
                onClick={(e) =>
                  actions.closeClick(
                    f.id,
                    formValue(e.currentTarget.form, `w-${f.id}`),
                    formValue(e.currentTarget.form, `wt-${f.id}`),
                  )
                }
              >
                Mérlegjegy rögzítése és lezárás
              </Btn>
            </Row>
          </form>
        </Panel>
      ) : (
        <p className="my-3 text-control">
          Mérlegelt nettó: <b>{tn(f.net)}</b> · szállítólevél:{" "}
          <span className="font-mono text-xs">
            {S.docs.find((d) => d.id === f.dn)?.number || "—"}
          </span>
        </p>
      )}
    </Panel>
  );
}
