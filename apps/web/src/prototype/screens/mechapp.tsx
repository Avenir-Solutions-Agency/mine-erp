"use client";

import { fmt, ft } from "@mine-erp/domain/demo";
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
} from "@/prototype/ui";
import { Phone, PhotoBtn } from "./operapp-parts";

const hm = (d: Date | string | number) =>
  new Date(d).toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });

// V.mechapp: work orders on the mechanic's phone.
export function MechAppScreen() {
  const { S, q, actions, view } = useDemo();
  const MCH = view.MCH;
  const empName = (id: string) => S.employees.find((e) => e.id === id)!.name;
  const mechs = S.employees.filter((e) => e.role === "Szerelő");
  const open = S.wos.filter((w) => w.status !== "Lezárva");
  const w = open.find((x) => x.id === MCH.sel) || open[0];
  const m = w && S.machines.find((x) => x.id === w.machine)!;
  const mech = w?.mech ?? [];
  const used = w?.used ?? [];

  return (
    <>
      <Head
        title="Szerelő app"
        sub="Minden javításból digitális munkalap. A szerelő a telefonján indítja és zárja, hozzáadja a társait, QR-kóddal veszi ki az alkatrészt: a raktárból le, a munkalapra és a gép költségére rá."
        right={
          <Field label="Szerelő">
            <Sel
              defaultValue={MCH.me}
              onCommit={(el) => actions.setMechanic(el.value)}
            >
              {mechs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Sel>
          </Field>
        }
      />
      <Grid cols={2}>
        <Panel>
          <h2>Nyitott munkalapok ({open.length})</h2>
          {open.length ? (
            open.map((x) => (
              <div
                key={x.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => actions.selectWo(x.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") actions.selectWo(x.id);
                }}
              >
                <Alert
                  lvl={
                    x.status === "Hibajegy"
                      ? "bad"
                      : x.status === "Folyamatban"
                        ? "ai"
                        : "warn"
                  }
                >
                  <b className="font-mono">{x.id}</b> ·{" "}
                  {S.machines.find((mm) => mm.id === x.machine)!.name}
                  <Small>
                    {x.name} · <StatusPill status={x.status} />
                  </Small>
                </Alert>
              </div>
            ))
          ) : (
            <p className="my-3 text-xs text-muted-foreground">
              Nincs nyitott munkalap.
            </p>
          )}
        </Panel>
        {w && m ? (
          <Phone>
            <form onSubmit={(e) => e.preventDefault()}>
              <Spread>
                <b className="font-mono">{w.id}</b>
                <StatusPill status={w.status} />
              </Spread>
              <div>{m.name}</div>
              <Small>
                {w.name}
                {w.ref ? " · forrás: " + w.ref : ""}
              </Small>
              <Small className="mt-1.5">
                Kezdés: {w.start ? hm(w.start) : "—"} · Szerelők:{" "}
                {mech.map(empName).join(", ") || "—"}
              </Small>
              <Row className="mt-2">
                {!w.start ? (
                  <Btn kind="pri" onClick={() => actions.woStart(w.id)}>
                    Munka indítása
                  </Btn>
                ) : null}
                {w.start && !mech.includes(MCH.me) ? (
                  <Btn onClick={() => actions.woJoin(w.id)}>Csatlakozom</Btn>
                ) : null}
              </Row>
              {w.start ? (
                <>
                  <h3 className="mt-2.5">Alkatrész kivétele</h3>
                  <Row>
                    <Sel name="jm-part" aria-label="Alkatrész">
                      {[...S.parts]
                        .sort(
                          (x, y) =>
                            Number(q.compatOK(y, w.machine)) -
                            Number(q.compatOK(x, w.machine)),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {q.compatOK(p, w.machine)
                              ? ""
                              : " (nem kompatibilis!)"}
                          </option>
                        ))}
                    </Sel>
                    <Inp
                      name="jm-q"
                      type="number"
                      step="0.5"
                      defaultValue="1"
                      className="w-20"
                      aria-label="Mennyiség"
                    />
                    <Btn
                      sm
                      onClick={(e) => {
                        const f = e.currentTarget.form;
                        actions.woPart(
                          w.id,
                          formValue(f, "jm-part"),
                          formValue(f, "jm-q"),
                        );
                      }}
                    >
                      Kivét (QR)
                    </Btn>
                  </Row>
                  {used.map((u, i) => (
                    <Small key={i}>
                      {u.name} · {fmt(u.q, 1)} {u.unit} · {ft(u.cost)}
                    </Small>
                  ))}
                  <Field label="Elvégzett javítás" className="mt-2">
                    <Inp
                      name="jm-done"
                      defaultValue={
                        w.status === "Hibajegy"
                          ? "tömítéscsere, nyomáspróba"
                          : "szerviz a gyártói előírás szerint"
                      }
                    />
                  </Field>
                  <Field label="Munkaóra összesen (ha eltér a mérttől)">
                    <Inp
                      name="jm-h"
                      type="number"
                      step="0.5"
                      defaultValue={w.hours || 3}
                    />
                  </Field>
                  <Row>
                    {/* Demo quirk: the photo input has no handler. */}
                    <PhotoBtn>Fotó</PhotoBtn>
                    <Btn
                      kind="pri"
                      onClick={(e) => {
                        const f = e.currentTarget.form;
                        actions.woClose(
                          w.id,
                          formValue(f, "jm-h"),
                          formValue(f, "jm-done"),
                        );
                      }}
                    >
                      Munkalap lezárása
                    </Btn>
                  </Row>
                </>
              ) : null}
            </form>
          </Phone>
        ) : null}
      </Grid>
      <Panel className="mt-3.5">
        <h2>Lezárt munkalapok</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Munkalap</TableHead>
              <TableHead>Gép</TableHead>
              <TableHead>Munka</TableHead>
              <TableHead>Szerelők</TableHead>
              <TableHead numeric>Óra</TableHead>
              <TableHead numeric>Alkatrész</TableHead>
              <TableHead numeric>Munkadíj</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.wos.some((x) => x.status === "Lezárva") ? (
              S.wos
                .filter((x) => x.status === "Lezárva")
                .map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Mono>{x.id}</Mono>
                    </TableCell>
                    <TableCell>{x.machine}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {x.done || x.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(x.mech || []).map(empName).join(", ") || "—"}
                    </TableCell>
                    <TableCell numeric>{fmt(x.hours, 1)}</TableCell>
                    <TableCell numeric>
                      {ft((x.used || []).reduce((a, u) => a + u.cost, 0))}
                    </TableCell>
                    <TableCell numeric>{ft(x.labor || 0)}</TableCell>
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
