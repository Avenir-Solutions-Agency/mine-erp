"use client";

import {
  approveInvoice,
  assignCarrier,
  carrierTotals,
  ds,
  filterLineRows,
  fmt,
  ft,
  invoiceCategories,
  invoiceKpis,
  seedInvoicePortal,
  sumLines,
  unassignInvoice,
  type IncomingInvoice,
  type InvoicePortal,
  type LineFilter,
} from "@mine-erp/domain/demo";
import { useRef, useSyncExternalStore } from "react";
import { Kpi } from "@/components/ui/kpi";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Alert,
  Btn,
  Grid,
  Inp,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  TabBar,
} from "@/prototype/ui";

// The boss's invoice portal (mpkft-szamlaportal-demo.netlify.app) as the "Bejövő számlák" tab.
// State lives outside React: Screen remounts the billing view on every engine render.
type PortalState = {
  portal: InvoicePortal;
  selected: string;
  view: string;
  filter: LineFilter;
};
let state: PortalState = {
  portal: seedInvoicePortal(),
  selected: "i1",
  view: "inbox",
  filter: { query: "", carrier: "", category: "" },
};
const listeners = new Set<() => void>();
function setState(patch: Partial<PortalState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
function usePortal() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

const VIEWS: [string, string][] = [
  ["inbox", "Beérkezett számlák"],
  ["items", "Tételek"],
  ["carriers", "Költségviselők"],
  ["upload", "Feltöltés"],
];

const qty = (n: number, unit: string) =>
  `${Number.isInteger(n) ? fmt(n) : fmt(n, 2)} ${unit}`;

function carrierName(p: InvoicePortal, id: string | null) {
  return p.carriers.find((c) => c.id === id)?.name;
}

function InvoiceStatusPill({ invoice }: { invoice: IncomingInvoice }) {
  if (invoice.assigned) return <Pill tone="success">Hozzárendelve</Pill>;
  return invoice.status === "unassigned" ? (
    <Pill tone="destructive">Besorolatlan</Pill>
  ) : (
    <Pill tone="warning">Ellenőrzés</Pill>
  );
}

export function InboundTab() {
  const { view } = usePortal();
  return (
    <>
      <TabBar
        items={VIEWS}
        active={view}
        onSelect={(v) => setState({ view: v })}
      />
      {view === "inbox" ? <InvoicesView /> : null}
      {view === "items" ? <ItemsView /> : null}
      {view === "carriers" ? <CarriersView /> : null}
      {view === "upload" ? <UploadView /> : null}
    </>
  );
}

function InvoicesView() {
  const { portal, selected } = usePortal();
  const k = invoiceKpis(portal);
  return (
    <>
      <Grid cols={4} className="mb-3.5">
        <Kpi label="Számla" value={k.count} />
        <Kpi label="Bruttó összesen" value={ft(k.gross)} />
        <Kpi label="Automatikusan besorolt" value={k.auto} />
        <Kpi
          label="Jóváhagyásra vár"
          value={
            <span className={cn(k.pending > 0 && "text-warning")}>
              {k.pending}
            </span>
          }
        />
      </Grid>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <Panel className="p-0">
          <h2 className="border-b border-border px-4 py-3">Számlák</h2>
          <ul>
            {portal.invoices.map((i) => (
              <li key={i.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-current={i.id === selected ? "true" : undefined}
                  onClick={() => setState({ selected: i.id })}
                  className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 px-4 py-2.5 text-left outline-ring hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 aria-[current]:bg-accent"
                >
                  <span className="font-semibold">{i.supplier}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {ft(i.gross)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ds(i.date)} · <Mono>{i.number}</Mono>
                  </span>
                  <span className="text-right">
                    <InvoiceStatusPill invoice={i} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <InvoiceDetail />
      </div>
    </>
  );
}

function InvoiceDetail() {
  const { portal, selected } = usePortal();
  const i = portal.invoices.find((x) => x.id === selected);
  if (!i) return null;
  const assigned = portal.carriers.find((c) => c.id === i.assigned);
  const pick = (carrierId: string) => {
    setState({ portal: assignCarrier(portal, i.id, carrierId) });
    toast(`Hozzárendelve: ${carrierName(portal, carrierId)}`);
  };
  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>{i.supplier}</h2>
          <Small>
            Adószám {i.taxNumber} · <Mono>{i.number}</Mono>
          </Small>
        </div>
        <InvoiceStatusPill invoice={i} />
      </div>
      <dl className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-2.5">
        {(
          [
            ["Kelt / teljesítés", ds(i.date)],
            ["Fizetési határidő", ds(i.due)],
            ["Fizetési mód", i.payment],
            ["Kategória", i.category],
            [
              "Nettó / ÁFA / bruttó",
              <Mono key="sum">
                {ft(i.net)} / {ft(i.vat)} / {ft(i.gross)}
              </Mono>,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-label tracking-wider text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tétel</TableHead>
            <TableHead numeric>Menny.</TableHead>
            <TableHead numeric>Egységár</TableHead>
            <TableHead numeric>Nettó</TableHead>
            <TableHead numeric>ÁFA</TableHead>
            <TableHead numeric>Bruttó</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {i.lines.map((l, n) => (
            <TableRow key={n}>
              <TableCell>{l.name}</TableCell>
              <TableCell numeric>{qty(l.qty, l.unit)}</TableCell>
              <TableCell numeric>{ft(l.unitPrice)}</TableCell>
              <TableCell numeric>{ft(l.net)}</TableCell>
              <TableCell numeric>{ft(l.vat)}</TableCell>
              <TableCell numeric>{ft(l.gross)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {i.warning ? <Alert lvl="bad">{i.warning}</Alert> : null}
      {i.note ? <Alert lvl="ok">{i.note}</Alert> : null}
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted p-3.5">
        <div className="text-label tracking-wider text-muted-foreground uppercase">
          Kézzel írt jelölés a számlán
        </div>
        <p className="mt-1 text-lg italic">„{i.handwriting}”</p>
        <div className="mt-3 text-label tracking-wider text-muted-foreground uppercase">
          AI-javaslat költségviselőre
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {i.candidates.map((k) => {
            const c = portal.carriers.find((x) => x.id === k.carrier);
            if (!c) return null;
            return (
              <li
                key={k.carrier}
                className="grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  <Small>
                    {c.type} · {k.why}
                  </Small>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums max-sm:col-span-2 max-sm:row-start-2">
                  <ProgressBar
                    value={k.confidence}
                    className="w-28"
                    aria-label={`${c.name} bizonyossága`}
                  />
                  {k.confidence}%
                </div>
                <Btn sm onClick={() => pick(k.carrier)}>
                  Ezt
                </Btn>
              </li>
            );
          })}
        </ul>
        <Row className="mt-2.5">
          <Sel
            aria-label="Más költségviselő"
            defaultValue=""
            onCommit={(el) => el.value && pick(el.value)}
          >
            <option value="">Más költségviselő…</option>
            {portal.carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </Sel>
          <Btn
            kind="pri"
            disabled={!assigned}
            onClick={() => {
              setState({ portal: approveInvoice(portal, i.id) });
              toast("Jóváhagyva");
            }}
          >
            {assigned
              ? `Jóváhagyás: ${assigned.name}`
              : "Válasszon költségviselőt"}
          </Btn>
          <Btn
            onClick={() => {
              setState({ portal: unassignInvoice(portal, i.id) });
              toast("Besorolatlan");
            }}
          >
            Besorolatlan
          </Btn>
        </Row>
        <Small className="mt-1.5">
          {assigned ? (
            <>
              Jelenleg: <b>{assigned.name}</b> ({assigned.type}).
            </>
          ) : (
            "Nincs hozzárendelve – a tétel a „besorolatlan” sorban marad, amíg valaki dönt."
          )}{" "}
          {i.status === "review"
            ? "A bizonyosság 85% alatt van, ezért emberi jóváhagyás kell."
            : null}
        </Small>
      </div>
    </Panel>
  );
}

function ItemsView() {
  const { portal, filter } = usePortal();
  const rows = filterLineRows(portal, filter);
  const total = sumLines(rows);
  const setFilter = (patch: Partial<LineFilter>) =>
    setState({ filter: { ...filter, ...patch } });
  return (
    <>
      <Row className="mb-3">
        <Inp
          aria-label="Keresés"
          placeholder="Keresés: szállító, tétel, számlaszám, költségviselő…"
          value={filter.query}
          onChange={(e) => setFilter({ query: e.currentTarget.value })}
          className="min-w-0 flex-[1_1_15rem]"
        />
        <select
          aria-label="Költségviselő"
          value={filter.carrier}
          onChange={(e) => setFilter({ carrier: e.currentTarget.value })}
          className="max-w-full rounded-lg border border-input bg-card px-2 py-1.5 text-control"
        >
          <option value="">Minden költségviselő</option>
          {portal.carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Besorolatlan</option>
        </select>
        <select
          aria-label="Kategória"
          value={filter.category}
          onChange={(e) => setFilter({ category: e.currentTarget.value })}
          className="max-w-full rounded-lg border border-input bg-card px-2 py-1.5 text-control"
        >
          <option value="">Minden kategória</option>
          {invoiceCategories(portal).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </Row>
      <Panel className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead>Szállító</TableHead>
              <TableHead>Számlaszám</TableHead>
              <TableHead>Tétel</TableHead>
              <TableHead>Kategória</TableHead>
              <TableHead numeric>Menny.</TableHead>
              <TableHead numeric>Nettó</TableHead>
              <TableHead numeric>ÁFA</TableHead>
              <TableHead numeric>Bruttó</TableHead>
              <TableHead>Költségviselő</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r, n) => (
                <TableRow
                  key={n}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() =>
                    setState({ selected: r.invoice.id, view: "inbox" })
                  }
                >
                  <TableCell className="whitespace-nowrap">
                    {ds(r.invoice.date)}
                  </TableCell>
                  <TableCell>{r.invoice.supplier}</TableCell>
                  <TableCell>
                    <Mono>{r.invoice.number}</Mono>
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.invoice.category}</TableCell>
                  <TableCell numeric>{qty(r.qty, r.unit)}</TableCell>
                  <TableCell numeric>{ft(r.net)}</TableCell>
                  <TableCell numeric>{ft(r.vat)}</TableCell>
                  <TableCell numeric>{ft(r.gross)}</TableCell>
                  <TableCell>
                    {carrierName(portal, r.invoice.assigned) ?? (
                      <i>besorolatlan</i>
                    )}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusPill invoice={r.invoice} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  Nincs a szűrésnek megfelelő tétel.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        {rows.length} tétel · nettó {ft(total.net)} · bruttó {ft(total.gross)}
      </Small>
    </>
  );
}

function CarriersView() {
  const { portal } = usePortal();
  return (
    <>
      <Panel className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Költségviselő</TableHead>
              <TableHead>Típus</TableHead>
              <TableHead>Aliasok</TableHead>
              <TableHead numeric>Tételek</TableHead>
              <TableHead numeric>Nettó összesen</TableHead>
              <TableHead numeric>Bruttó összesen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carrierTotals(portal).map(({ carrier: c, lines, net, gross }) => (
              <TableRow key={c?.id ?? "none"}>
                <TableCell>
                  {c ? (
                    <>
                      <b>{c.name}</b>
                      {c.note ? <Small>{c.note}</Small> : null}
                    </>
                  ) : (
                    <i>Besorolatlan</i>
                  )}
                </TableCell>
                <TableCell>{c?.type ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c?.aliases.join(", ")}
                </TableCell>
                <TableCell numeric>{lines}</TableCell>
                <TableCell numeric>{ft(net)}</TableCell>
                <TableCell numeric>{ft(gross)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        Az élesben a járművek és gépek a Mine ERP jármű- és géptörzséből jönnek;
        itt a hat számlához elegendő törzset vettünk fel. Az aliasok (becenevek,
        rövidítések) a kézírás felismerését segítik.
      </Small>
    </>
  );
}

const STEPS: [string, string][] = [
  [
    "1. Beérkezés",
    "Szkenner-mappa, e-mail (szamla@…) vagy mobilfotó. Duplikátum-szűrés számlaszám + adószám alapján.",
  ],
  [
    "2. Nyomtatott adat kinyerése",
    "Szállító, adószám, számlaszám, dátumok, fizetési mód, tételek, nettó/ÁFA/bruttó. Összegellenőrzés: tételek összege = végösszeg.",
  ],
  [
    "3. Kézírás értelmezése",
    "A kézzel írt jelölést a költségviselő-törzshöz illeszti, bizonyossági pontszámmal. 85% felett automatikus, alatta jóváhagyásra vár.",
  ],
  [
    "4. Nyilvántartás",
    "Kereshető tételtábla, költségviselőnkénti összesítés, export Excelbe; a gépköltség a rendszerterv 4.6 pontja szerint a termékárba folyik.",
  ],
];

function UploadView() {
  const file = useRef<HTMLInputElement>(null);
  const received = (n: number) =>
    toast(`${n} fájl fogadva – élesben itt indulna a feldolgozás`);
  return (
    <>
      <button
        type="button"
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          received(e.dataTransfer.files.length);
        }}
        className="mb-4 w-full cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-7 text-center text-muted-foreground outline-ring hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        Húzza ide a szkennelt számlát vagy fotót (PDF, JPG, PNG) — vagy
        kattintson.
        <Small className="mt-1">
          A demóban a feltöltés nem dolgoz fel új fájlt; a folyamat az alábbi
          lépésekkel futna.
        </Small>
      </button>
      <input
        ref={file}
        type="file"
        hidden
        multiple
        accept=".pdf,image/*"
        onChange={(e) => {
          received(e.currentTarget.files?.length ?? 0);
          e.currentTarget.value = "";
        }}
      />
      <Grid cols={4}>
        {STEPS.map(([title, text]) => (
          <Panel key={title}>
            <b className="mb-1 block">{title}</b>
            <Small>{text}</Small>
          </Panel>
        ))}
      </Grid>
    </>
  );
}
