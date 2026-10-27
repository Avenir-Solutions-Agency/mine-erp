"use client";

import { ds, fmt, ft, mft, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { readPhoto } from "@/prototype/files";
import { SigPad, sigData } from "@/prototype/sig-pad";
import { StatusPill } from "@/prototype/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hu } from "@/i18n/hu";
import { cn } from "@/lib/utils";
import {
  Btn,
  Field,
  formChecked,
  formValue,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
} from "@/prototype/ui";
import { Placeholder } from "./placeholder";

// V.portal with the signature box patch (contracts and TIGs waiting for the customer).
export function PortalScreen() {
  const demo = useDemo();
  const { S, q, actions, ui, TODAY } = demo;
  const c = q.C(ui.sel.portal ?? "");
  if (!c) return <Placeholder route="portal" message={hu.empty} />;
  const qs = S.quotes.filter((x) => x.clientId === c.id);
  const os = S.orders.filter((o) => o.clientId === c.id);
  const fs = S.transports.filter((f) => f.clientId === c.id);
  const dd = S.docs.filter((d) => d.clientName === c.name);
  return (
    <>
      <Head
        title="Vevői portál"
        sub="Amit a vevő lát a saját bejelentkezésével (portal.mpkft.hu): ajánlatok elfogadása, szállítások követése, szállítólevelek és számlák, újrarendelés."
        right={
          <Field label="Megtekintés mint">
            <Sel
              defaultValue={c.id}
              onCommit={(el) => actions.setPortalClient(el.value)}
            >
              {S.clients.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Sel>
          </Field>
        }
      />
      <Grid cols={4}>
        <Kpi
          label="Hitelkeret"
          value={c.limit ? mft(c.limit - c.used) : "—"}
          detail={c.limit ? `szabad, keret ${mft(c.limit)}` : "előre fizetés"}
        />
        <Kpi
          label="Nyitott ajánlat"
          value={qs.filter((x) => x.status === "Kiküldve").length}
        />
        <Kpi
          label="Ma úton"
          value={fs.filter((f) => f.status === "Úton").length}
        />
        <Kpi
          label="Nyitott számla"
          value={mft(
            dd
              .filter(
                (d) => d.type === "Számla" && !d.paid && d.status !== "Sztornó",
              )
              .reduce((a, d) => a + (d.gross || 0), 0),
          )}
        />
      </Grid>
      <SignBox clientId={c.id} />
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Ajánlataim</h2>
          <Table>
            <TableBody>
              {qs.length ? (
                qs.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Mono>{x.id}</Mono>
                    </TableCell>
                    <TableCell>
                      {x.pr.lines
                        .map((l) => l.name + " " + tn(l.qty))
                        .join(", ")}
                    </TableCell>
                    <TableCell numeric>{ft(x.pr.gross)}</TableCell>
                    <TableCell>
                      {x.status === "Kiküldve" && !x.orderId ? (
                        <Btn
                          kind="pri"
                          sm
                          onClick={() => actions.portalAccept(x.id)}
                        >
                          Elfogadom
                        </Btn>
                      ) : (
                        <StatusPill
                          status={
                            x.orderId
                              ? "Megrendelve"
                              : x.status === "Jóváhagyásra vár"
                                ? "Készül"
                                : x.status
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">
                    Nincs ajánlat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Row className="mt-2.5">
            {os[0] ? (
              <Btn onClick={() => actions.portalReorder(os[0].id)}>
                Legutóbbi rendelés megismétlése
              </Btn>
            ) : null}
            <Btn onClick={() => demo.go("inbox")}>Új ajánlatkérés</Btn>
          </Row>
        </Panel>
        <Panel>
          <h2>Szállításaim</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nap</TableHead>
                <TableHead>Termék</TableHead>
                <TableHead numeric>Nettó t</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead>Bizonylat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fs.some((f) => f.status !== "Törölve") ? (
                fs
                  .filter((f) => f.status !== "Törölve")
                  .slice(0, 12)
                  .map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        {ds(f.date)}
                        <Small>{f.truck}</Small>
                      </TableCell>
                      <TableCell>{q.P(f.pid).name}</TableCell>
                      <TableCell numeric>
                        {f.net != null ? fmt(f.net, 1) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={f.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {S.docs.find((d) => d.id === f.dn)?.number || ""}
                        {f.ekaer.number ? (
                          <div className="font-mono">
                            EKÁER {f.ekaer.number}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">
                    Nincs szállítás.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      </Grid>
      <Panel className="mt-3.5">
        <h2>Számláim</h2>
        <Table>
          <TableBody>
            {dd.some((d) => d.type === "Számla") ? (
              dd
                .filter((d) => d.type === "Számla")
                .map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Mono>{d.number || d.id}</Mono>
                    </TableCell>
                    <TableCell numeric>{ft(d.gross)}</TableCell>
                    <TableCell>
                      {d.due ? "esedékes " + ds(d.due) : ""}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={
                          d.paid
                            ? "Kiegyenlítve"
                            : d.due && d.due < TODAY
                              ? "Lejárt"
                              : d.status
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
            ) : (
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">
                  Nincs számla.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

function SignBox({ clientId }: { clientId: string }) {
  const { S, q, actions } = useDemo();
  const cs = S.contracts.filter(
    (x) => x.clientId === clientId && x.status === "Kiküldve",
  );
  const tg = S.tigs.filter(
    (x) => x.clientId === clientId && x.status === "Aláírásra vár",
  );
  if (!cs.length && !tg.length) return null;
  return (
    <Panel className="mt-3.5 border-ai">
      <h2>Aláírásra vár</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        {cs.map((x) => (
          <details key={x.id} open>
            <summary className="cursor-pointer text-control">
              <b>{x.id}</b> — szerződés ({x.order})
            </summary>
            <pre className="max-h-105 overflow-auto rounded-lg border border-border bg-muted p-3.5 font-sans text-control whitespace-pre-wrap">
              {q.contractText(x)}
            </pre>
            <Field label="Aláíró neve, beosztása">
              <Inp
                name={`cs-n-${x.id}`}
                defaultValue={
                  clientId === "c1"
                    ? "Dr. Fekete Ildikó beszerzési igazgató"
                    : "Képviselő"
                }
              />
            </Field>
            <SigPad id={`cs-s-${x.id}`} label="Aláírás" />
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name={`cs-ok-${x.id}`} /> A szerződést
              elolvastam, a cég nevében aláírásra jogosult vagyok.
            </label>
            <Row>
              <Btn
                kind="pri"
                onClick={(e) => {
                  const form = e.currentTarget.form;
                  actions.portalSignContract(
                    x.id,
                    formValue(form, `cs-n-${x.id}`),
                    formChecked(form, `cs-ok-${x.id}`),
                    sigData(`cs-s-${x.id}`),
                  );
                }}
              >
                Szerződés aláírása
              </Btn>
              <label
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "cursor-pointer text-control",
                )}
              >
                Aláírt példány feltöltése
                <input
                  type="file"
                  accept="image/*,.pdf"
                  hidden
                  onChange={async (e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    const { img, name } = await readPhoto(f);
                    actions.photoUpload("contract", x.id, img, name);
                  }}
                />
              </label>
            </Row>
          </details>
        ))}
        {tg.map((x) => {
          const L = q.tigLines(x);
          return (
            <details key={x.id} open className="mt-2.5">
              <summary className="cursor-pointer text-control">
                <b>{x.id}</b> — teljesítésigazolás, {x.trips.length} forduló,{" "}
                {tn(L.tons)}, nettó {ft(L.total)}
              </summary>
              <Small className="my-3">
                Részletek a TIG menüben; itt a vevő elfogadja.
              </Small>
              <Btn onClick={() => actions.openTigFromPortal(x.id)}>
                TIG megnyitása és aláírása
              </Btn>
            </details>
          );
        })}
      </form>
    </Panel>
  );
}
