"use client";

import { ds, fmt, ft, pct } from "@mine-erp/domain/demo";
import Link from "next/link";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
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
  formValue,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";

// V.store with the work order and tank panels (round 2), the QR hint, and the RFID, card import and compat patches.
export function StoreScreen() {
  const demo = useDemo();
  const { S, q, actions } = demo;
  const rs = q.reorderSuggestions();
  const partName = (sid: string) => S.parts.find((s) => s.id === sid)!.name;
  const machineName = (mid: string) =>
    S.machines.find((m) => m.id === mid)!.name;

  return (
    <>
      <Head
        title="Üzemi raktár"
        sub="Alkatrész, kenőanyag, üzemanyag. Minden kiadás egy géphez kötődik, így a költség a gépre és onnan a termékárra kerül."
      />
      <Grid cols={2}>
        <Panel>
          <h2>Készlet és rendelési pont</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cikk</TableHead>
                <TableHead numeric>Készlet</TableHead>
                <TableHead>Fedezet</TableHead>
                {/* Demo quirk: the header is added, the body cell never is. */}
                <TableHead>Kompatibilis gépek</TableHead>
                <TableHead numeric>Egységár</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rs.map((s) => {
                const part = S.parts.find((p) => p.id === s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.name}
                      <Small>
                        {s.sup} · {s.lead} nap
                        {part ? (
                          <>
                            {" "}
                            ·{" "}
                            <span title="Kompatibilis gépek">
                              {part.compat?.join(", ")}
                            </span>
                          </>
                        ) : null}
                      </Small>
                    </TableCell>
                    <TableCell numeric>
                      {fmt(s.qty, s.qty % 1 ? 1 : 0)} {s.unit}
                      <Small>min. {fmt(s.min)}</Small>
                    </TableCell>
                    <TableCell>
                      <Bar
                        pct={(s.cover / 60) * 100}
                        tone={s.need ? (s.qty < s.min ? "bad" : "warn") : ""}
                        label={`${s.name} fedezet`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {s.cover > 900 ? "—" : fmt(s.cover) + " nap"}
                      </span>
                    </TableCell>
                    <TableCell numeric>{ft(s.price)}</TableCell>
                    <TableCell>
                      {s.need ? (
                        <Btn kind="ai" sm onClick={() => actions.poClick(s.id)}>
                          Rendelés: {fmt(s.sugg)} {s.unit}
                        </Btn>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
        <Stack>
          <Panel>
            <h2>Kiadás gépre</h2>
            <Small className="my-3">
              Napi munkában a{" "}
              <Link
                href="/qr"
                className="text-primary underline"
                onClick={(e) => {
                  e.preventDefault();
                  demo.go("qr");
                }}
              >
                QR raktár
              </Link>{" "}
              szkenneléses kiadását használják; ez a kézi tartalék.
            </Small>
            <form
              className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget;
                actions.submitIssue(
                  formValue(f, "is-s"),
                  formValue(f, "is-q"),
                  formValue(f, "is-m"),
                );
              }}
            >
              <Field label="Cikk">
                <Sel name="is-s">
                  {S.parts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label="Gép">
                <Sel name="is-m">
                  {S.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label="Mennyiség">
                <Inp name="is-q" type="number" step="0.1" defaultValue="420" />
              </Field>
              <Row className="self-end">
                <Btn kind="pri" type="submit">
                  Kiadás
                </Btn>
              </Row>
            </form>
            <Small className="my-3">
              Élesben a kúti tankolás a kútautomatából (gépazonosító + liter)
              automatikusan érkezik.
            </Small>
          </Panel>
          <Panel>
            <h2>Beszerzési rendelések</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Cikk</TableHead>
                  <TableHead numeric>Menny.</TableHead>
                  <TableHead>Állapot</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {S.pos.length ? (
                  S.pos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Mono>{p.id}</Mono>
                      </TableCell>
                      <TableCell>
                        {p.name}
                        <Small>{p.sup}</Small>
                      </TableCell>
                      <TableCell numeric>{fmt(p.qty)}</TableCell>
                      <TableCell>
                        <StatusPill status={p.status} />
                      </TableCell>
                      <TableCell>
                        {p.status === "Megrendelve (PO)" ? (
                          <Btn sm onClick={() => actions.receivePo(p.id)}>
                            Beérkeztetés
                          </Btn>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-xs text-muted-foreground"
                    >
                      Jóváhagyott rendelés még nincs.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <h2>Utolsó kiadások</h2>
            {S.issues.filter((i) => !i.labor).length ? (
              S.issues
                .filter((i) => !i.labor)
                .slice(-6)
                .reverse()
                .map((i, n) => (
                  <Alert key={n} lvl="">
                    {partName(i.sid)} — {fmt(i.qty, 1)} →{" "}
                    {machineName(i.machine)} <Mono>{ft(i.cost)}</Mono>
                  </Alert>
                ))
            ) : (
              <p className="my-3 text-xs text-muted-foreground">
                Még nincs kiadás ebben a munkamenetben.
              </p>
            )}
          </Panel>
        </Stack>
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Munkalapok</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Munkalap</TableHead>
                <TableHead>Gép</TableHead>
                <TableHead>Esedékes</TableHead>
                <TableHead>Alkatrész-foglalás</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.wos.length ? (
                S.wos.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">
                      {w.id}
                      <Small>{w.name}</Small>
                    </TableCell>
                    <TableCell>{machineName(w.machine)}</TableCell>
                    <TableCell>{ds(w.due)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.kit.map((k) => {
                        const s = S.parts.find((x) => x.id === k.sid)!;
                        return (
                          <div key={k.sid}>
                            {s.name} {fmt(k.q)} {s.unit}{" "}
                            {s.qty >= k.q ? "✓" : "— hiány"}
                          </div>
                        );
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={w.status} />
                    </TableCell>
                    <TableCell>
                      {w.status !== "Lezárva" ? (
                        <Btn sm onClick={() => actions.closeWoClick(w.id)}>
                          Lezárás
                        </Btn>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-xs text-muted-foreground"
                  >
                    Nincs nyitott munkalap.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
        <Panel>
          <h2>Kúttartály-egyeztetés</h2>
          <Small className="my-3">
            Heti pálcás mérés vs. könyvi készlet (nyitó + töltés − kútautomata
            kiadásai). 1% feletti eltérés vizsgálatot indít.
          </Small>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              actions.submitTank(+formValue(e.currentTarget, "tk-l"));
            }}
          >
            <Field label="Mért mennyiség (l)">
              <Inp
                name="tk-l"
                type="number"
                defaultValue={Math.round(S.parts[0].qty * 0.982)}
              />
            </Field>
            <Btn kind="pri" type="submit" className="self-end">
              Egyeztetés
            </Btn>
          </form>
          {S.tank.map((t, i) => (
            <Alert key={i} lvl={Math.abs(t.rel) > 0.01 ? "bad" : "ok"}>
              Mért {fmt(t.dip)} l · könyvi {fmt(t.book)} l · {fmt(t.diff)} l (
              {pct(t.rel)})
            </Alert>
          ))}
        </Panel>
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <Spread>
            <h2>Kút — RFID-tankolások</h2>
            <span className="text-xs text-muted-foreground">
              gép RFID-címke → liter → gépköltség
            </span>
          </Spread>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitRfid(formValue(f, "rf-m"), +formValue(f, "rf-l"));
            }}
          >
            <Sel name="rf-m" aria-label="Gép">
              {S.machines
                .filter((m) => m.stage !== "fuvar")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              {S.trucks.slice(0, 6).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </Sel>
            <Inp
              name="rf-l"
              type="number"
              defaultValue="237"
              className="w-22.5"
              aria-label="Liter"
            />
            <Btn kind="pri" type="submit">
              Tankolás (szimuláció)
            </Btn>
          </form>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Idő</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead>Gép</TableHead>
                <TableHead numeric>Liter</TableHead>
                <TableHead numeric>Költség</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.fuelLog.length ? (
                S.fuelLog.map((x, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">
                      {x.t}
                    </TableCell>
                    <TableCell>
                      <Mono className="text-muted-foreground">{x.tag}</Mono>
                    </TableCell>
                    <TableCell>{x.m}</TableCell>
                    <TableCell numeric>{fmt(x.l)}</TableCell>
                    <TableCell numeric>{ft(x.cost)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-xs text-muted-foreground"
                  >
                    Még nincs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
        <Panel>
          <Spread>
            <h2>Üzemanyagkártya-import (teherautók)</h2>
            <Btn sm onClick={() => actions.cardImport()}>
              Heti kártyaexport betöltése
            </Btn>
          </Spread>
          <Small className="my-3">
            A kártyakibocsátó exportja (rendszám, kút, liter, összeg)
            automatikusan a jármű költségére kerül, és összevetődik az iTrack
            által detektált tankolással.
          </Small>
          {S.cardImp?.length ? (
            S.cardImp.map((x) => (
              <Alert key={x.truck} lvl={x.ok ? "ok" : "bad"}>
                {x.truck} · {x.where} · {x.l} l · {ft(x.cost)}{" "}
                {x.ok
                  ? "— iTrack egyezik"
                  : `— iTrack ${x.it} l, eltérés ${x.l - x.it} l`}
              </Alert>
            ))
          ) : (
            <p className="my-3 text-xs text-muted-foreground">
              Még nincs import.
            </p>
          )}
        </Panel>
      </Grid>
    </>
  );
}
