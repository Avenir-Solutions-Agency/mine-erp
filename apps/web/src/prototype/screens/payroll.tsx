"use client";

import { ds, fmt, fmtH, ft, mft } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { Kpi } from "@/components/ui/kpi";
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
  Alert,
  Btn,
  Field,
  Flow,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Sel,
  Small,
  Spread,
  Stack,
  type Level,
} from "@/prototype/ui";

const STEPS = ["Előkészítve", "AI-ellenőrzés kész", "Jóváhagyva", "Exportálva"];
const PCT_CFG: [string, string][] = [
  ["szja", "SZJA (%)"],
  ["tb", "TB-járulék (%)"],
  ["szocho", "Szocho (%)"],
  ["ot", "Túlórapótlék (%)"],
  ["night", "Éjszakai pótlék (%)"],
  ["shift", "Műszakpótlék (%)"],
];

// V.payroll (round 4) with the live October period.
export function PayrollScreen() {
  const { S, q, actions, view } = useDemo();
  const { PAY, PAYCFG } = view;
  const okt = S.payroll.periodKey === "okt";
  const rows = q.empsFor().map((e) => ({ e, c: q.payCalc(e) }));
  const tot = (k: "gross" | "net" | "cost") =>
    rows.reduce((a, r) => a + r.c[k], 0);
  const chk = q.payChecks();
  const cur = rows.find((r) => r.e.id === PAY.sel);
  const st = S.payroll.status;
  const next = (
    {
      Előkészítve: ["AI-ellenőrzés kész", actions.payAi],
      "AI-ellenőrzés kész": ["Vezetői jóváhagyás", actions.payOk],
      Jóváhagyva: ["Export a bérszámfejtőnek", () => void actions.payExport()],
    } as Record<string, [string, () => void]>
  )[st];
  const stIdx = STEPS.indexOf(st);

  return (
    <>
      <Head
        title="Bérszámfejtés"
        sub="Bérelőkészítés a rendszerben lévő adatokból: jelenlét, menetidő (tachográf/iTrack), átvétellel vagy TIG-gel igazolt fordulók, munkalapok, műszaknapló, szabadság. A hivatalos számfejtés és a 08-as bevallás a bérszámfejtő programban marad (export)."
        right={
          <Field label="Időszak">
            <Sel
              defaultValue={S.payroll.periodKey}
              onCommit={(el) =>
                actions.setPayPeriod(el.value === "okt" ? "okt" : "szept")
              }
            >
              <option value="szept">
                2026. szeptember (lezárt, importált adatok)
              </option>
              <option value="okt">
                2026. október 1–3. (élő, a rendszer fuvaraiból)
              </option>
            </Sel>
          </Field>
        }
      />
      {okt ? (
        <AiBox who="Élő időszak" className="mb-3">
          <p className="mt-1">
            A sofőrök jelenléte, menetideje, éjszakai órái és igazolt fordulói
            közvetlenül a lezárt és elfogadott fuvarokból számolódnak (rakodás,
            út, lerakás + napi 1 óra előkészítés). Ha a Sofőr appban átvételt
            rögzít vagy TIG-et fogad el, a teljesítménybér itt azonnal nő. A
            szombati munka túlórának számít (rendes munkaidő: 2 nap × 8 óra).
          </p>
        </AiBox>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <Flow steps={STEPS.map((s, i) => [s, i <= stIdx])} />
        {next ? (
          <Btn kind="pri" sm onClick={next[1]}>
            {next[0]}
          </Btn>
        ) : null}
      </div>
      <Grid cols={4}>
        <Kpi label="Bruttó bér" value={mft(tot("gross"))} />
        <Kpi label="Nettó kifizetés" value={mft(tot("net"))} />
        <Kpi
          label="Munkáltatói költség"
          value={mft(tot("cost"))}
          detail="szocho 13%"
        />
        <Kpi
          label="Ellenőrzési tétel"
          value={
            <span className={chk.length ? "text-warning" : undefined}>
              {chk.length}
            </span>
          }
        />
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Sofőrök</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Név</TableHead>
                <TableHead numeric>Jelenlét</TableHead>
                <TableHead numeric>Menetidő</TableHead>
                <TableHead numeric>Igazolt forduló</TableHead>
                <TableHead numeric>Túlóra</TableHead>
                <TableHead numeric>Bruttó</TableHead>
                <TableHead numeric>Nettó</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .filter((r) => r.e.kind === "driver")
                .map((r) => (
                  <TableRow
                    key={r.e.id}
                    className="cursor-pointer"
                    data-selected={PAY.sel === r.e.id || undefined}
                    onClick={() => actions.paySelect(r.e.id)}
                  >
                    <TableCell>{r.e.name}</TableCell>
                    <TableCell numeric>{r.e.att} h</TableCell>
                    <TableCell numeric>{r.e.drive} h</TableCell>
                    <TableCell numeric>
                      {r.e.tripsOk}/{r.e.trips}
                    </TableCell>
                    <TableCell numeric>
                      {fmt(Math.max(0, r.e.att - S.payroll.work), 1)} h
                    </TableCell>
                    <TableCell numeric>{ft(r.c.gross)}</TableCell>
                    <TableCell numeric>{ft(r.c.net)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <h2 className="mt-3.5">Egyéb dolgozók</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Név</TableHead>
                <TableHead>Munkakör</TableHead>
                <TableHead numeric>Jelenlét</TableHead>
                <TableHead numeric>Pótlék-óra</TableHead>
                <TableHead numeric>Bruttó</TableHead>
                <TableHead numeric>Nettó</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .filter((r) => r.e.kind !== "driver")
                .map((r) => (
                  <TableRow
                    key={r.e.id}
                    className="cursor-pointer"
                    data-selected={PAY.sel === r.e.id || undefined}
                    onClick={() => actions.paySelect(r.e.id)}
                  >
                    <TableCell>{r.e.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.e.role}
                    </TableCell>
                    <TableCell numeric>{r.e.att} h</TableCell>
                    <TableCell numeric>
                      {r.e.shiftH || r.e.night || 0} h
                    </TableCell>
                    <TableCell numeric>{ft(r.c.gross)}</TableCell>
                    <TableCell numeric>{ft(r.c.net)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Panel>
        <Stack>
          {cur ? (
            <Panel>
              <Spread>
                <h2>Bérjegyzék-előnézet</h2>
                <Small>{cur.e.role}</Small>
              </Spread>
              <h3>{cur.e.name}</h3>
              <Table>
                <TableBody>
                  {cur.c.lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {l[0]}
                        <Small>forrás: {l[2]}</Small>
                      </TableCell>
                      <TableCell numeric>{ft(l[1])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Bruttó</TableCell>
                    <TableCell numeric>{ft(cur.c.gross)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>SZJA 15%</TableCell>
                    <TableCell numeric>−{ft(cur.c.szja)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>TB-járulék 18,5%</TableCell>
                    <TableCell numeric>−{ft(cur.c.tb)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <b>Nettó (kedvezmények előtt)</b>
                    </TableCell>
                    <TableCell numeric>
                      <b>{ft(cur.c.net)}</b>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-muted-foreground">
                      Munkáltatói szocho 13%
                    </TableCell>
                    <TableCell
                      numeric
                      className="text-xs text-muted-foreground"
                    >
                      {ft(cur.c.szocho)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              {cur.e.live ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nap</TableHead>
                      <TableHead>Fuvar</TableHead>
                      <TableHead>Idő</TableHead>
                      <TableHead numeric>Vez.</TableHead>
                      <TableHead>Igazolás</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cur.e.live.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{ds(f.date)}</TableCell>
                        <TableCell>
                          <Mono>{f.id}</Mono>
                        </TableCell>
                        <TableCell>
                          <Mono className="text-muted-foreground">
                            {fmtH(f.start || 6)}–
                            {fmtH((f.start || 6) + (f.dur || 0))}
                          </Mono>
                        </TableCell>
                        <TableCell numeric>{fmt(f.drive || 0, 1)} h</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.pod
                            ? "átvétel aláírva"
                            : q.tigOk(f)
                              ? "TIG elfogadva"
                              : f.status === "Lezárva"
                                ? "igazolásra vár"
                                : "tervezett"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              {cur.e.kind === "driver" ? (
                <Small className="mt-2">
                  Fordulók: {cur.e.trips} teljesített, ebből {cur.e.tripsOk}{" "}
                  átvétellel/TIG-gel igazolt. Várakozás a lerakókon:{" "}
                  {cur.e.wait} h (munkaidő, a vevőnek állásidőként
                  továbbszámlázva).
                </Small>
              ) : null}
            </Panel>
          ) : null}
          <Panel>
            <h2>AI-ellenőrzés</h2>
            {chk.length ? (
              chk.map(([l, e, t], i) => (
                <Alert key={i} lvl={l as Level}>
                  <b>{e.name}</b>: {t}
                </Alert>
              ))
            ) : (
              <Small>Nincs eltérés.</Small>
            )}
          </Panel>
          <Panel>
            <h2>Paraméterek</h2>
            <Grid cols={2}>
              {PCT_CFG.map(([k, l]) => (
                <Field key={k} label={l}>
                  <Inp
                    type="number"
                    step="0.5"
                    defaultValue={Number(PAYCFG[k]) * 100}
                    onCommit={(el) => actions.setPayCfgPct(k, el.value)}
                  />
                </Field>
              ))}
              <Field label="Garantált bérminimum (Ft)">
                <Inp
                  type="number"
                  defaultValue={Number(PAYCFG.guaranteed)}
                  onCommit={(el) => actions.setPayCfg("guaranteed", el.value)}
                />
              </Field>
              <Field label="Eco-prémium ≥85 pont (Ft)">
                <Inp
                  type="number"
                  defaultValue={Number(PAYCFG.ecoHi)}
                  onCommit={(el) => actions.setPayCfg("ecoHi", el.value)}
                />
              </Field>
            </Grid>
            <Small className="mt-2">
              A családi és egyéb kedvezményeket, a levonásokat és a 08-as
              bevallást a bérszámfejtő program kezeli. A kulcsokat évente
              ellenőrizni kell.
            </Small>
          </Panel>
          <Panel>
            <h2>Folyamat</h2>
            {S.payroll.steps.map((s, i) => (
              <Small key={i}>
                {s[1]} · <b>{s[0]}</b> — {s[2]}
              </Small>
            ))}
            {st === "Exportálva" ? (
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-muted p-2.5 font-mono text-label">
                {q.payCSV().split("\n").slice(0, 6).join("\n")}
                {"\n…"}
              </pre>
            ) : null}
          </Panel>
        </Stack>
      </Grid>
    </>
  );
}
