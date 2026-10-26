"use client";

import type { Doc } from "@mine-erp/domain/demo";
import { ds, fmt, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
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
  Flow,
  Grid,
  Head,
  Inp,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";
import { PhotoBtn, SigImg } from "./driverapp-parts";

const STATES = [
  "Kiállításra vár",
  "Úton / átvételre vár",
  "Átvéve (aláírva)",
  "Számlázva",
  "Sztornó",
];

// V.dn: delivery notes, round 4.
export function DnScreen() {
  const { S, q, view, ui, actions, TODAY } = useDemo();
  const all = S.docs.filter((d) => d.type === "Szállítólevél");
  const cnt = (s: string) => all.filter((d) => q.dnState(d) === s).length;
  const rows = q.dnRows();
  const cur = S.docs.find((d) => d.id === ui.sel.dnd) || rows[0];
  const noDn = S.transports.filter((f) => f.status === "Lezárva" && !f.dn);
  const unsigned = all.filter(
    (d) => !d.pod && d.number && (+TODAY - +d.created) / 864e5 >= 1,
  );
  const curF = cur && S.transports.find((f) => f.id === cur.ref);
  return (
    <>
      <Head
        title="Szállítólevelek"
        sub="Szállítólevél minden lezárt mérlegelésből automatikusan (Billingo). Átvételkor a vevő a sofőr tabletjén aláírja vagy a sofőr lefotózza a papírt. Innen indul a TIG és a számla."
      />
      <Grid cols={4}>
        <Kpi label="Úton / átvételre vár" value={cnt("Úton / átvételre vár")} />
        <Kpi label="Átvéve, számlázatlan" value={cnt("Átvéve (aláírva)")} />
        <Kpi label="Számlázva" value={cnt("Számlázva")} />
        <Kpi
          label="Átvétel nélkül 24 h után"
          value={
            <span className={unsigned.length ? "text-warning" : undefined}>
              {unsigned.length}
            </span>
          }
        />
      </Grid>
      <Panel className="mt-3.5">
        <Row>
          <Inp
            placeholder="Keresés: szám, fuvar, megrendelés"
            defaultValue={view.DNF.q}
            aria-label="Keresés"
            className="min-w-60"
            onCommit={(el) => actions.setDnFilter("q", el.value)}
          />
          <Sel
            aria-label="Állapot"
            defaultValue={view.DNF.st}
            onCommit={(el) => actions.setDnFilter("st", el.value)}
          >
            <option value="">Minden állapot</option>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Sel>
          <Sel
            aria-label="Vevő"
            defaultValue={view.DNF.client}
            onCommit={(el) => actions.setDnFilter("client", el.value)}
          >
            <option value="">Minden vevő</option>
            {S.clients.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </Sel>
          <PhotoBtn
            sm
            onPhoto={(img, name) =>
              actions.photoUpload("extdn", undefined, img, name)
            }
          >
            Külsős szállítólevél (fotó)
          </PhotoBtn>
        </Row>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Szám</TableHead>
              <TableHead>Kelt</TableHead>
              <TableHead>Vevő</TableHead>
              <TableHead>Fuvar · jármű</TableHead>
              <TableHead>Termék</TableHead>
              <TableHead numeric>Nettó t</TableHead>
              <TableHead>EKÁER</TableHead>
              <TableHead>Átvétel</TableHead>
              <TableHead>TIG · számla</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((d) => {
                const f = S.transports.find((x) => x.id === d.ref);
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => actions.openDn(d.id)}
                  >
                    <TableCell className="font-mono text-xs">
                      {d.number || "—"}
                    </TableCell>
                    <TableCell>{ds(d.created)}</TableCell>
                    <TableCell>{d.clientName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.ref}
                      <br />
                      {f?.truck || ""}
                    </TableCell>
                    <TableCell>{q.P(d.pid!).name}</TableCell>
                    <TableCell numeric>{fmt(d.qty, 2)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {f?.ekaer?.number || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.pod ? d.pod.name : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f?.tig || "—"}
                      <br />
                      {f?.inv
                        ? S.docs.find((x) => x.id === f.inv)?.number ||
                          "piszkozat"
                        : ""}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={q.dnState(d)} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-xs text-muted-foreground"
                >
                  Nincs találat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Grid cols={2} className="mt-3.5">
        <div>
          {cur ? (
            <Panel>
              <Spread>
                <h2>{cur.number || cur.id}</h2>
                <StatusPill status={q.dnState(cur)} />
              </Spread>
              <DnDoc d={cur} />
              <Row className="mt-2.5">
                <Btn sm onClick={() => actions.resendDn(cur.id)}>
                  Újraküldés e-mailben
                </Btn>
                {q.dnState(cur) !== "Számlázva" && cur.status !== "Sztornó" ? (
                  <>
                    <Btn sm onClick={() => actions.correctDn(cur.id)}>
                      Tömeg-korrekció
                    </Btn>
                    <Btn sm kind="bad" onClick={() => actions.stornoDn(cur.id)}>
                      Sztornó
                    </Btn>
                  </>
                ) : null}
              </Row>
              <Flow
                className="mt-2.5"
                steps={[
                  ["Mérlegjegy", true],
                  ["Szállítólevél", true],
                  ["Átvétel", !!cur.pod],
                  ["TIG", !!curF?.tig],
                  ["Számla", !!curF?.inv],
                ]}
              />
            </Panel>
          ) : null}
        </div>
        <Stack>
          <Panel>
            <h2>Ellenőrzések</h2>
            {noDn.map((f) => (
              <Alert key={f.id} lvl="bad">
                {f.id}: lezárt fuvar szállítólevél nélkül (Billingo-sorban?)
              </Alert>
            ))}
            {unsigned.length ? (
              unsigned.map((d) => (
                <Alert key={d.id} lvl="warn">
                  {d.number}: 24 óránál régebbi, átvételi aláírás nélkül — a
                  sofőr töltse fel a papír fotóját
                </Alert>
              ))
            ) : (
              <Small className="my-3">Minden rendben.</Small>
            )}
          </Panel>
          <Panel>
            <h2>Havi összesítő vevőnként</h2>
            <Table>
              <TableBody>
                {S.clients.map((c) => {
                  const list = all.filter((d) => d.clientName === c.name);
                  return list.length ? (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell numeric>{list.length} db</TableCell>
                      <TableCell numeric>
                        {tn(list.reduce((a, d) => a + d.qty!, 0))}
                      </TableCell>
                    </TableRow>
                  ) : null;
                })}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <h2>Külsős szállítólevelek</h2>
            <Small className="my-3">
              Partnertől beszerzett áru (pl. mosott homok) szállítólevele
              fotóval; a bevételezéshez és a 3-utas számlaegyeztetéshez
              kapcsolódik.
            </Small>
            {S.extdn.length ? (
              S.extdn.map((x, i) => (
                <Row key={i} className="text-xs text-muted-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo as a data URL */}
                  <img src={x.img} alt="" className="w-15 rounded-xs" />{" "}
                  {x.name} · {ds(x.t)}
                </Row>
              ))
            ) : (
              <Small className="my-3">Még nincs.</Small>
            )}
          </Panel>
        </Stack>
      </Grid>
    </>
  );
}

// dnDoc(): the printable delivery note sheet.
function DnDoc({ d }: { d: Doc }) {
  const { S, q } = useDemo();
  const f = S.transports.find((x) => x.id === d.ref);
  const o = S.orders.find((x) => x.id === d.order);
  const c = o ? q.C(o.clientId) : undefined;
  const p = q.P(d.pid!);
  const gross = +(
    d.qty! + ((q.TR(f?.truck)?.cap ?? 0) > 20 ? 15.2 : 12.4)
  ).toFixed(2);
  return (
    <div className="rounded-lg border border-border bg-muted p-3.5">
      <Spread>
        <div>
          <b>SZÁLLÍTÓLEVÉL</b>
          <div className="font-mono text-xs">
            {d.number || "(kiállítás alatt)"}
          </div>
        </div>
        <Small className="text-right">
          Kelt: {ds(d.created)}
          <br />
          Fuvar: {f?.id || ""} · Megrendelés: {o?.id || ""}
        </Small>
      </Spread>
      <Grid cols={2} className="mt-2">
        <div>
          <Small>Eladó / feladó</Small>
          Mészkő-Polgár Kft.
          <br />
          8154 Polgárdi, Bánya út 1.
          <br />
          Adószám: 12312312-2-07
          <br />
          <span className="text-xs text-muted-foreground">
            Rakodás: {q.D(f?.depot || p.depot).name}
          </span>
        </div>
        <div>
          <Small>Vevő / címzett</Small>
          {o?.clientName || d.clientName}
          <br />
          {c?.zip ? `${c.zip} ${c.city}` : ""}
          <br />
          {c?.tax ? `Adószám: ${c.tax}` : "magánszemély"}
          <br />
          <span className="text-xs text-muted-foreground">
            Lerakás: {o?.zip || ""} {o?.city || ""} {o?.addr || ""}
          </span>
        </div>
      </Grid>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Termék</TableHead>
            <TableHead>VTSZ</TableHead>
            <TableHead numeric>Bruttó</TableHead>
            <TableHead numeric>Tára</TableHead>
            <TableHead numeric>Nettó</TableHead>
            <TableHead>Mérlegjegy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>{p.name}</TableCell>
            <TableCell className="font-mono text-xs">{p.vtsz}</TableCell>
            <TableCell numeric>{fmt(gross, 2)} t</TableCell>
            <TableCell numeric>{fmt(gross - d.qty!, 2)} t</TableCell>
            <TableCell numeric>
              <b>{fmt(d.qty, 2)} t</b>
            </TableCell>
            <TableCell className="font-mono text-xs">
              MJ-{(f?.id || "").slice(7)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Grid cols={2} className="mt-2">
        <Small>
          Jármű: {f?.truck || ""} · Sofőr: {f?.driver || ""}
          <br />
          EKÁER: {f?.ekaer?.number || "nem bejelentésköteles"}
          <br />
          Teljesítménynyilatkozat: DoP-MP-{p.id.toUpperCase()}-2026 · CE · MSZ
          EN 13242
        </Small>
        <div>
          {d.pod ? (
            <>
              <Small>
                Átvette: {d.pod.name} ·{" "}
                {new Date(d.pod.t).toLocaleString("hu-HU", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <br />
                {d.pod.how}
                {d.pod.gps ? " · " + d.pod.gps : ""}
              </Small>
              <SigImg src={d.pod.img} alt="Átvevő aláírása" />
            </>
          ) : (
            <Small>Átvevő aláírása: —</Small>
          )}
        </div>
      </Grid>
    </div>
  );
}
