"use client";

import { ds, fmt, ft, mft, type Doc } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
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
  Alert,
  Bar,
  Btn,
  Grid,
  Inp,
  Json,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
} from "@/prototype/ui";

const TYPES = [
  "Számla (TIG alapján)",
  "Gyűjtőszámla (havi)",
  "Előlegszámla",
  "Díjbekérő",
  "Helyesbítő számla",
  "Sztornó",
];

const gross = (d: Doc) => d.gross || d.amount * 1.27;

export function OutTab() {
  const { S, q, actions, view, ui, TODAY } = useDemo();
  const F = view.INVF;
  const late = (d: Doc) => !!d.due && +d.due < +TODAY;
  const outs = S.docs
    .filter((d) => d.type === "Számla")
    .filter(
      (d) =>
        (!F.q ||
          ((d.number || "") + d.clientName + d.order)
            .toLowerCase()
            .includes(F.q.toLowerCase())) &&
        (!F.type || q.invType(d) === F.type),
    );
  const cur =
    S.docs.find((d) => d.id === ui.sel.doc && d.type === "Számla") || outs[0];
  const sum = (k: (d: Doc) => boolean) =>
    outs.filter(k).reduce((a, d) => a + gross(d), 0);

  return (
    <>
      <Grid cols={4}>
        <Kpi
          label="Kiállított, nyitott"
          value={mft(
            sum((d) => !d.paid && d.status !== "Sztornó" && !!d.number),
          )}
        />
        <Kpi
          label="Lejárt"
          value={
            <span className="text-destructive">
              {mft(sum((d) => !d.paid && d.status !== "Sztornó" && late(d)))}
            </span>
          }
        />
        <Kpi
          label="Jóváhagyásra vár"
          value={
            <span className="text-ai">
              {outs.filter((d) => d.status === "Jóváhagyásra vár").length}
            </span>
          }
        />
        <Kpi
          label="NAV-ra beküldve"
          value={`${outs.filter((d) => /Befogadva/.test(d.nav)).length} / ${outs.filter((d) => d.number).length}`}
        />
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <Row>
            <Inp
              placeholder="Keresés: szám, vevő, megrendelés"
              aria-label="Keresés"
              defaultValue={F.q}
              onCommit={(el) => actions.setInvFilter("q", el.value)}
            />
            <Sel
              aria-label="Típus"
              defaultValue={F.type}
              onCommit={(el) => actions.setInvFilter("type", el.value)}
            >
              <option value="">Minden típus</option>
              {TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Sel>
            <Btn sm onClick={() => actions.newAdvance()}>
              Előlegszámla / díjbekérő
            </Btn>
          </Row>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Szám</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead>Vevő</TableHead>
                <TableHead numeric>Bruttó</TableHead>
                <TableHead>Esedékes</TableHead>
                <TableHead>NAV</TableHead>
                <TableHead>Fizetés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outs.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => actions.selectDoc(d.id)}
                >
                  <TableCell className="font-mono">
                    {d.number || d.id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {q.invType(d)}
                  </TableCell>
                  <TableCell>{d.clientName}</TableCell>
                  <TableCell numeric>{ft(gross(d))}</TableCell>
                  <TableCell>{d.due ? ds(d.due) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.nav}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      status={
                        d.status === "Sztornó"
                          ? "Sztornó"
                          : d.paid
                            ? "Kiegyenlítve"
                            : late(d)
                              ? "Lejárt"
                              : d.status
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <div>{cur ? <InvoiceDetail doc={cur} /> : null}</div>
      </Grid>
    </>
  );
}

function InvoiceDetail({ doc: cur }: { doc: Doc }) {
  const { S, q, actions } = useDemo();
  const tigs = S.tigs
    .filter((t) => t.order === cur.order)
    .map((t) => t.id)
    .join(", ");
  return (
    <Panel>
      <Spread>
        <h2>
          {q.invType(cur)} {cur.number || cur.id}
        </h2>
        <StatusPill status={cur.paid ? "Kiegyenlítve" : cur.status} />
      </Spread>
      <div className="rounded-lg border border-border bg-muted p-3.5">
        <Spread>
          <b>SZÁMLA</b>
          <span className="font-mono">{cur.number || "piszkozat"}</span>
        </Spread>
        <Grid cols={2}>
          <Small>
            Eladó: Mészkő-Polgár Kft.
            <br />
            12312312-2-07
          </Small>
          <Small>
            Vevő: {cur.clientName}
            <br />
            Teljesítés: {ds(cur.created)} · Esedékes:{" "}
            {cur.due ? ds(cur.due) : "—"}
          </Small>
        </Grid>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tétel</TableHead>
              <TableHead numeric>Menny.</TableHead>
              <TableHead numeric>Egységár</TableHead>
              <TableHead numeric>Nettó</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(cur.items || []).map((i, n) => (
              <TableRow key={n}>
                <TableCell>{i.name}</TableCell>
                <TableCell numeric>
                  {fmt(i.quantity, 2)} {i.unit}
                </TableCell>
                <TableCell numeric>{ft(i.unit_price)}</TableCell>
                <TableCell numeric>{ft(i.unit_price * i.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Nettó / ÁFA 27% / Bruttó</TableCell>
              <TableCell numeric>
                {ft(cur.amount)} / {ft(cur.amount * 0.27)} / {ft(gross(cur))}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <Small>
          Kapcsolódó: {cur.ref} · TIG: {tigs || "—"}
        </Small>
      </div>
      <Row className="mt-2">
        {cur.status === "Jóváhagyásra vár" ? (
          <Btn kind="pri" onClick={() => actions.issueClick(cur.id)}>
            Jóváhagyom, kiállítás a Billingóban
          </Btn>
        ) : null}
        {cur.number && cur.status !== "Sztornó" && !cur.paid ? (
          <>
            <Btn sm onClick={() => actions.correctInvoice(cur.id)}>
              Helyesbítő számla
            </Btn>
            <Btn kind="bad" sm onClick={() => actions.stornoInvoice(cur.id)}>
              Sztornó
            </Btn>
            <Btn sm onClick={() => actions.markPaid(cur.id)}>
              Kiegyenlítés rögzítése
            </Btn>
          </>
        ) : null}
      </Row>
      <details className="mt-2">
        <summary className="text-xs text-muted-foreground">
          Billingo API kérés
        </summary>
        <Json value={cur.payload} />
      </details>
    </Panel>
  );
}

export function QueueTab() {
  const { S, q, actions } = useDemo();
  const rows = S.orders
    .map((o) => {
      const fs = S.transports.filter(
        (f) => f.order === o.id && f.status === "Lezárva" && !f.inv,
      );
      return {
        o,
        acc: fs.filter((f) => q.tigOk(f)),
        wait: fs.filter((f) => !q.tigOk(f)),
      };
    })
    .filter((x) => x.acc.length || x.wait.length);
  return (
    <Panel>
      <h2>Számlázási sor</h2>
      <p className="my-3 text-xs text-muted-foreground">
        Számla csak elfogadott TIG-ből készül. A TIG-re váró fordulók a
        Teljesítésigazolás menüben kezelhetők.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Megrendelés</TableHead>
            <TableHead>Vevő</TableHead>
            <TableHead numeric>Számlázható forduló</TableHead>
            <TableHead numeric>TIG-re vár</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((x) => (
              <TableRow key={x.o.id}>
                <TableCell className="font-mono">{x.o.id}</TableCell>
                <TableCell>{x.o.clientName}</TableCell>
                <TableCell numeric>{x.acc.length}</TableCell>
                <TableCell numeric>{x.wait.length}</TableCell>
                <TableCell>
                  {x.acc.length ? (
                    <Btn
                      sm
                      kind="pri"
                      onClick={() => actions.invoiceClick(x.o.id)}
                    >
                      Számla
                    </Btn>
                  ) : null}
                  {x.wait.length ? (
                    <Btn sm onClick={() => actions.makeTig(x.o.id)}>
                      TIG
                    </Btn>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-xs text-muted-foreground">
                Üres.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}

const AGE = ["Nem lejárt", "1–7 nap", "8–15 nap", "15 nap felett"];

// The round-2 receivables part of V.billing (ageing + dunning).
export function ArTab() {
  const { S, actions, TODAY } = useDemo();
  const b = [0, 0, 0, 0];
  S.docs
    .filter(
      (d) => d.type === "Számla" && !d.paid && d.status !== "Sztornó" && d.due,
    )
    .forEach((d) => {
      const days = (+TODAY - +d.due!) / 864e5;
      b[days <= 0 ? 0 : days <= 7 ? 1 : days <= 15 ? 2 : 3] += d.gross ?? 0;
    });
  const max = Math.max(...b, 1);
  return (
    <Grid cols={2} className="mt-3.5">
      <Panel>
        <h2>Kintlévőség korosítása</h2>
        <Table>
          <TableBody>
            {AGE.map((l, i) => (
              <TableRow key={l}>
                <TableCell>{l}</TableCell>
                <TableCell numeric>{mft(b[i])}</TableCell>
                <TableCell className="w-2/5">
                  <Bar
                    pct={(b[i] / max) * 100}
                    tone={i >= 2 ? "bad" : i === 1 ? "warn" : ""}
                    label={l}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Row className="mt-2">
          <Btn sm onClick={() => actions.syncClick()}>
            Fizetések lekérdezése a Billingóból
          </Btn>
        </Row>
      </Panel>
      <Panel>
        <h2>Követeléskezelő</h2>
        {S.dunning.length ? (
          S.dunning.map((x, i) => (
            <Alert key={i} lvl={x.lvl >= 3 ? "bad" : "warn"}>
              <b>
                {x.lvl}. fok · {x.client}
              </b>{" "}
              {x.number}, {x.days} nap · {x.status}
              <Small>{x.txt}</Small>
            </Alert>
          ))
        ) : (
          <p className="my-3 text-xs text-muted-foreground">
            Nincs lejárt számla.
          </p>
        )}
      </Panel>
    </Grid>
  );
}

const RULES = [
  "Eseti vevő: számla a TIG elfogadásakor, megrendelésenként",
  "Keretszerződéses vevő (V-Híd): havi gyűjtőszámla a havi TIG-ből",
  "Magánszemély, új ügyfél: díjbekérő vagy előlegszámla, kiszállítás a befizetés után",
];

export function SettingsTab() {
  const { S } = useDemo();
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Bizonylattömbök (Billingo)</h2>
        <Table>
          <TableBody>
            {[
              ["Számla", "MP-2026-####"],
              ["Szállítólevél", "MP-SZL-2026-####"],
              ["Előleg / díjbekérő", "MP-E-2026-####"],
            ].map(([k, v]) => (
              <TableRow key={k}>
                <TableCell>{k}</TableCell>
                <TableCell>
                  <Mono>{v}</Mono>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel>
        <h2>Számlázási szabályok</h2>
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>
            Auto-kiállítás bruttó {mft(S.policy.autoInvoiceMaxGross)} alatt,
            felette jóváhagyás
          </li>
          <li>Fizetés-párosítás naponta (Billingo + bankkivonat)</li>
          <li>
            NAV Online Számla: a Billingo küldi, a státuszt visszaolvassuk
          </li>
        </ul>
      </Panel>
    </Grid>
  );
}
