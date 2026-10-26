"use client";

import { ds, fmt, ft } from "@mine-erp/domain/demo";
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
  TabBar,
} from "@/prototype/ui";
import { PhotoBtn } from "./operapp-parts";

const TABS: [string, string][] = [
  ["list", "Beszállítások"],
  ["new", "Új beszállítás"],
  ["part", "Partnerek és engedély"],
  ["rep", "Havi nyilvántartás"],
  ["bill", "Számlázás"],
];

// V.waste: landfill deliveries, permit, monthly register and invoicing.
export function WasteScreen() {
  const { view, actions } = useDemo();
  const tab = view.WASTE.tab;
  return (
    <>
      <Head
        title="Hulladéklerakó"
        sub="Partner, rendszám, hulladékkód, mérlegelés, kísérő dokumentum, díj és számlázás egy helyen, közös mérleggel és ügyféltörzzsel."
      />
      <TabBar
        items={TABS}
        active={tab}
        onSelect={(k) => actions.setWasteTab(k)}
      />
      {tab === "list" ? <ListTab /> : null}
      {tab === "new" ? <NewTab /> : null}
      {tab === "part" ? <PartTab /> : null}
      {tab === "rep" ? <RepTab /> : null}
      {tab === "bill" ? <BillTab /> : null}
    </>
  );
}

function ListTab() {
  const { S } = useDemo();
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sorszám</TableHead>
            <TableHead>Nap</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Rendszám</TableHead>
            <TableHead>Hulladékkód</TableHead>
            <TableHead numeric>Nettó</TableHead>
            <TableHead>Kísérő dok.</TableHead>
            <TableHead numeric>Díj</TableHead>
            <TableHead>Állapot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {S.wlog.map((w) => (
            <TableRow key={w.id}>
              <TableCell>
                <Mono>{w.id}</Mono>
              </TableCell>
              <TableCell>{ds(w.date)}</TableCell>
              <TableCell>
                {S.wpart.find((p) => p.id === w.partner)!.name}
              </TableCell>
              <TableCell>
                <Mono>{w.plate}</Mono>
              </TableCell>
              <TableCell>
                <Mono>{w.code}</Mono>
                <Small>{S.wcodes.find((c) => c.code === w.code)!.name}</Small>
              </TableCell>
              <TableCell numeric>{fmt(w.net, 2)} t</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {w.doc}
                {w.photo ? " · fotó" : ""}
              </TableCell>
              <TableCell numeric>
                {ft((w.fee ?? 0) + (w.taxFee ?? 0))}
              </TableCell>
              <TableCell>
                <StatusPill status={w.inv ? "Számlázva" : "Kiállításra vár"} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function NewTab() {
  const { S, view, actions } = useDemo();
  const pre = view.WASTE.pre;
  const pt =
    S.wpart.find((p) => pre && p.plates.includes(pre.plate)) || S.wpart[0];
  return (
    <Panel>
      <h2>Hulladék-beszállítás</h2>
      <Small className="my-3">
        A mérleg és a rendszámfelismerés tölti a partnert, a bruttót és a tárát;
        a kezelő a hulladékkódot és a kísérő dokumentumot rögzíti. A fogadási
        engedélyben nem szereplő kódot a rendszer nem engedi.
      </Small>
      <form
        className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          actions.submitWaste({
            partner: formValue(f, "w-p"),
            plate: formValue(f, "w-plate"),
            code: formValue(f, "w-code"),
            doc: formValue(f, "w-doc"),
            gross: formValue(f, "w-g"),
            tare: formValue(f, "w-t"),
          });
        }}
      >
        <Field label="Partner">
          <Sel name="w-p" defaultValue={pt.id}>
            {S.wpart.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Sel>
        </Field>
        <Field label="Rendszám">
          <Inp name="w-plate" defaultValue={pre?.plate || pt.plates[0]} />
        </Field>
        <Field label="Hulladékkód">
          <Sel name="w-code">
            {S.wcodes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
                {c.ok ? "" : " (engedélyben nincs)"}
              </option>
            ))}
          </Sel>
        </Field>
        <Field label="Kísérő dokumentum száma">
          <Inp name="w-doc" defaultValue={`SZJ-2026-${100 + S.wlog.length}`} />
        </Field>
        <Field label="Bruttó (t, mérleg)">
          <Inp
            name="w-g"
            type="number"
            step="0.01"
            defaultValue={pre?.gross || 31.8}
          />
        </Field>
        <Field label="Tára (t, járműtörzs)">
          <Inp name="w-t" type="number" step="0.01" defaultValue="14.2" />
        </Field>
        <PhotoBtn onPhoto={(img) => actions.setWastePhoto(img)}>
          Kísérő dokumentum fotója
        </PhotoBtn>
        <Row>
          <Btn kind="pri" type="submit">
            Rögzítés
          </Btn>
        </Row>
      </form>
    </Panel>
  );
}

function PartTab() {
  const { S, actions } = useDemo();
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Partnerek</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>KÜJ / KTJ</TableHead>
              <TableHead>Rendszámok</TableHead>
              <TableHead>Szerződött kódok</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.wpart.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.kuj} / {p.ktj}
                </TableCell>
                <TableCell>
                  <Mono className="text-muted-foreground">
                    {p.plates.join(", ")}
                  </Mono>
                </TableCell>
                <TableCell>
                  <Mono className="text-muted-foreground">
                    {p.codes.join(", ")}
                  </Mono>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="my-3 text-xs text-muted-foreground">
          A partner a közös ügyféltörzsből jön (a V-Híd vevő és
          hulladék-beszállító is).
        </p>
      </Panel>
      <Panel>
        <h2>Fogadási engedély és díjak</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kód</TableHead>
              <TableHead>Megnevezés</TableHead>
              <TableHead numeric>Díj (Ft/t)</TableHead>
              <TableHead>Engedély</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.wcodes.map((c) => (
              <TableRow key={c.code}>
                <TableCell>
                  <Mono>{c.code}</Mono>
                </TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell numeric>{c.ok ? ft(c.price) : "—"}</TableCell>
                <TableCell>
                  {c.ok ? (
                    <Pill tone="success">fogadható</Pill>
                  ) : (
                    <Pill tone="destructive">nem fogadható</Pill>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Field
          label="Lerakási járulék (Ft/t) — a jogszabály szerinti értéket a felmérésben kell rögzíteni"
          className="mt-2"
        >
          <Inp
            type="number"
            defaultValue={S.wpolicy.tax}
            onCommit={(el) => actions.setWasteTax(el.value)}
          />
        </Field>
      </Panel>
    </Grid>
  );
}

function RepTab() {
  const { S, actions } = useDemo();
  const by: Record<string, number> = {};
  S.wlog.forEach((w) => {
    by[w.code] = (by[w.code] || 0) + w.net;
  });
  return (
    <Panel>
      <h2>Havi nyilvántartás — 2026. október</h2>
      <Small className="my-3">
        Hulladékkódonként átvett mennyiség; ebből készül a hatósági
        adatszolgáltatás (a pontos kötelezettséget a felmérésben jogilag
        tisztázni kell).
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kód</TableHead>
            <TableHead>Megnevezés</TableHead>
            <TableHead numeric>Átvett (t)</TableHead>
            <TableHead numeric>Beszállítás</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(by).map(([k, v]) => (
            <TableRow key={k}>
              <TableCell>
                <Mono>{k}</Mono>
              </TableCell>
              <TableCell>{S.wcodes.find((c) => c.code === k)!.name}</TableCell>
              <TableCell numeric>{fmt(v, 2)}</TableCell>
              <TableCell numeric>
                {S.wlog.filter((w) => w.code === k).length}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Row className="mt-2">
        <Btn onClick={() => void actions.wasteCsvDownload()}>
          Nyilvántartás letöltése (CSV)
        </Btn>
      </Row>
    </Panel>
  );
}

function BillTab() {
  const { S, actions } = useDemo();
  const rows = S.wpart
    .map((p) => ({
      p,
      ws: S.wlog.filter((w) => w.partner === p.id && !w.inv),
    }))
    .filter((r) => r.ws.length);
  return (
    <Panel>
      <h2>Havi gyűjtőszámla partnerenként</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead numeric>Beszállítás</TableHead>
            <TableHead numeric>Tonna</TableHead>
            <TableHead numeric>Nettó díj</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map(({ p, ws }) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell numeric>{ws.length}</TableCell>
                <TableCell numeric>
                  {fmt(
                    ws.reduce((a, w) => a + w.net, 0),
                    2,
                  )}
                </TableCell>
                <TableCell numeric>
                  {ft(
                    ws.reduce((a, w) => a + (w.fee ?? 0) + (w.taxFee ?? 0), 0),
                  )}
                </TableCell>
                <TableCell>
                  <Btn kind="pri" sm onClick={() => actions.wasteInvoice(p.id)}>
                    Számla (Billingo)
                  </Btn>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-xs text-muted-foreground">
                Nincs számlázatlan beszállítás.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}
