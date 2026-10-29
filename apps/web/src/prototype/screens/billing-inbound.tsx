"use client";

import type { CarrierDto, InvoiceDto } from "@mine-erp/contracts";
import { ds, fmt, ft } from "@mine-erp/domain/demo";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { Pill } from "@/components/ui/pill";
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

// "Bejövő számlák": real invoices from the API (T-034) through the /api/erp proxy.
// State lives outside React: Screen remounts the billing view on every engine render.
type Load = "idle" | "loading" | "ready" | "error" | "login";
type PortalState = {
  load: Load;
  error: string;
  invoices: InvoiceDto[];
  carriers: CarrierDto[];
  selected: string | null;
  view: string;
  filter: { query: string; carrier: string; category: string };
  uploading: number;
};
let state: PortalState = {
  load: "idle",
  error: "",
  invoices: [],
  carriers: [],
  selected: null,
  view: "inbox",
  filter: { query: "", carrier: "", category: "" },
  uploading: 0,
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

class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the API through the BFF; errors carry the API's Hungarian message. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/erp/${path}`, init);
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message: string };
  } | null;
  if (!res.ok || !body || body.data === undefined)
    throw new ApiFailure(
      res.status,
      body?.error?.message ?? "Váratlan hiba, próbálja újra.",
    );
  return body.data;
}

async function reload() {
  setState({ load: "loading" });
  try {
    const [invoices, carriers] = await Promise.all([
      api<InvoiceDto[]>("invoices"),
      api<CarrierDto[]>("carriers"),
    ]);
    setState({
      load: "ready",
      invoices,
      carriers,
      selected: state.selected ?? invoices[0]?.id ?? null,
    });
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401)
      setState({ load: "login" });
    else setState({ load: "error", error: (e as Error).message });
  }
}

function replaceInvoice(next: InvoiceDto) {
  const exists = state.invoices.some((i) => i.id === next.id);
  setState({
    invoices: exists
      ? state.invoices.map((i) => (i.id === next.id ? next : i))
      : [next, ...state.invoices],
  });
}

/** Money arrives as forint strings; it becomes a number only for display (hu-HU). */
const huf = (s: string | null) => (s == null ? "—" : ft(Number(s)));
const sumOf = (xs: (string | null)[]) =>
  xs.reduce((a, s) => a + (s ? Number(s) : 0), 0);
const date = (d: string | null) => (d ? ds(d) : "—");

const VIEWS: [string, string][] = [
  ["inbox", "Beérkezett számlák"],
  ["items", "Tételek"],
  ["carriers", "Költségviselők"],
  ["upload", "Feltöltés"],
];

function InvoiceStatusPill({ invoice }: { invoice: InvoiceDto }) {
  if (invoice.status === "assigned")
    return <Pill tone="success">Hozzárendelve</Pill>;
  return invoice.status === "unassigned" ? (
    <Pill tone="destructive">Besorolatlan</Pill>
  ) : (
    <Pill tone="warning">Ellenőrzés</Pill>
  );
}

export function InboundTab() {
  const { view, load, error } = usePortal();
  useEffect(() => {
    if (state.load === "idle") void reload();
  }, []);
  return (
    <>
      <TabBar
        items={VIEWS}
        active={view}
        onSelect={(v) => setState({ view: v })}
      />
      {load === "idle" || load === "loading" ? (
        <Small>Betöltés…</Small>
      ) : load === "login" ? (
        <Alert lvl="warn">
          A számlák megtekintéséhez{" "}
          <Link href="/login" className="font-semibold underline">
            jelentkezzen be
          </Link>
          .
        </Alert>
      ) : load === "error" ? (
        <Alert lvl="bad">
          {error}{" "}
          <Btn sm onClick={() => void reload()}>
            Újra
          </Btn>
        </Alert>
      ) : (
        <>
          {view === "inbox" ? <InvoicesView /> : null}
          {view === "items" ? <ItemsView /> : null}
          {view === "carriers" ? <CarriersView /> : null}
          {view === "upload" ? <UploadView /> : null}
        </>
      )}
    </>
  );
}

function InvoicesView() {
  const { invoices, selected } = usePortal();
  if (!invoices.length)
    return (
      <EmptyState message="Még nincs feltöltött számla. A Feltöltés fülön adhat hozzá PDF-et vagy fotót." />
    );
  const pending = invoices.filter((i) => i.status !== "assigned").length;
  return (
    <>
      <Grid cols={4} className="mb-3.5">
        <Kpi label="Számla" value={invoices.length} />
        <Kpi
          label="Bruttó összesen"
          value={ft(sumOf(invoices.map((i) => i.gross)))}
        />
        <Kpi
          label="Hozzárendelve"
          value={invoices.filter((i) => i.status === "assigned").length}
        />
        <Kpi
          label="Ellenőrzésre vár"
          value={
            <span className={cn(pending > 0 && "text-warning")}>{pending}</span>
          }
        />
      </Grid>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <Panel className="p-0">
          <h2 className="border-b border-border px-4 py-3">Számlák</h2>
          <ul>
            {invoices.map((i) => (
              <li key={i.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-current={i.id === selected ? "true" : undefined}
                  onClick={() => setState({ selected: i.id })}
                  className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 px-4 py-2.5 text-left outline-ring hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 aria-[current]:bg-accent"
                >
                  <span className="font-semibold">
                    {i.supplier ?? i.fileName}
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {huf(i.gross)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {date(i.issueDate)} · <Mono>{i.number ?? "—"}</Mono>
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

async function assign(id: string, costCarrier: string | null) {
  try {
    replaceInvoice(
      await api<InvoiceDto>(`invoices/${id}/carrier`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ costCarrier }),
      }),
    );
    toast(costCarrier ? `Hozzárendelve: ${costCarrier}` : "Besorolatlan");
  } catch (e) {
    toast((e as Error).message);
  }
}

function InvoiceDetail() {
  const { invoices, carriers, selected } = usePortal();
  const [imageOpen, setImageOpen] = useState(false);
  const i = invoices.find((x) => x.id === selected);
  if (!i) return null;
  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>{i.supplier ?? i.fileName}</h2>
          <Small>
            Adószám {i.supplierTaxNumber ?? "—"} ·{" "}
            <Mono>{i.number ?? "—"}</Mono>
          </Small>
        </div>
        <InvoiceStatusPill invoice={i} />
      </div>
      <dl className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-2.5">
        {(
          [
            ["Kelte", date(i.issueDate)],
            ["Fizetési határidő", date(i.dueDate)],
            ["Fizetési mód", i.paymentMethod ?? "—"],
            ["Kategória", i.category ?? "—"],
            [
              "Nettó / ÁFA / bruttó",
              <Mono key="sum">
                {huf(i.net)} / {huf(i.vat)} / {huf(i.gross)}
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
            <TableHead numeric>ÁFA %</TableHead>
            <TableHead numeric>Bruttó</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {i.lines.length ? (
            i.lines.map((l, n) => (
              <TableRow key={n}>
                <TableCell>{l.name}</TableCell>
                <TableCell numeric>
                  {l.quantity == null
                    ? "—"
                    : `${fmt(Number(l.quantity), Number.isInteger(Number(l.quantity)) ? 0 : 2)} ${l.unit ?? ""}`}
                </TableCell>
                <TableCell numeric>{huf(l.unitPrice)}</TableCell>
                <TableCell numeric>{huf(l.net)}</TableCell>
                <TableCell numeric>{l.vatRate ?? "—"}</TableCell>
                <TableCell numeric>{huf(l.gross)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                A tételek nem olvashatók.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {i.warning ? <Alert lvl="bad">{i.warning}</Alert> : null}
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-label tracking-wider text-muted-foreground uppercase">
              Kézzel írt jelölés a számlán
            </div>
            <p className="mt-1 text-lg italic">
              {i.handwriting ? `„${i.handwriting}”` : "Nincs kézírás."}
            </p>
          </div>
          <Btn sm onClick={() => setImageOpen(true)}>
            Számlakép megtekintése
          </Btn>
        </div>
        <Row className="mt-2.5">
          <Sel
            aria-label="Költségviselő"
            key={`${i.id}-${i.costCarrier}`}
            defaultValue=""
            onCommit={(el) => el.value && void assign(i.id, el.value)}
          >
            <option value="">Költségviselő választása…</option>
            {carriers.map((c) => (
              <option key={`${c.type}-${c.name}`} value={c.name}>
                {c.name} ({c.type === "vehicle" ? "jármű" : "gép"}
                {c.detail ? ` · ${c.detail}` : ""})
              </option>
            ))}
          </Sel>
          <Btn onClick={() => void assign(i.id, null)}>Besorolatlan</Btn>
        </Row>
        <Small className="mt-1.5">
          {i.costCarrier ? (
            <>
              Jelenleg: <b>{i.costCarrier}</b>.
            </>
          ) : (
            "Nincs hozzárendelve: csak akkor sorolódik be magától, ha a kézírás pontosan egy rendszámra vagy gépre illik."
          )}
        </Small>
      </div>
      <InvoiceImageDialog
        invoice={i}
        open={imageOpen}
        onOpenChange={setImageOpen}
      />
    </Panel>
  );
}

/** The stored invoice file, streamed through our origin so the frame can print it. */
function InvoiceImageDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const src = `/api/erp/invoices/${invoice.id}/file?raw=1`;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setLoaded(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Számlakép · {invoice.supplier ?? invoice.fileName}
          </DialogTitle>
        </DialogHeader>
        <div className="relative h-[70vh] overflow-hidden rounded-lg border border-border bg-muted">
          {!loaded ? <Small className="absolute p-3">Betöltés…</Small> : null}
          <iframe
            ref={frame}
            src={src}
            title={`Számlakép: ${invoice.supplier ?? invoice.fileName}`}
            onLoad={() => setLoaded(true)}
            className="size-full bg-card"
          />
        </div>
        <DialogFooter>
          <Btn
            kind="pri"
            disabled={!loaded}
            onClick={() => frame.current?.contentWindow?.print()}
          >
            Nyomtatás
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemsView() {
  const { invoices, filter } = usePortal();
  const setFilter = (patch: Partial<PortalState["filter"]>) =>
    setState({ filter: { ...filter, ...patch } });
  const q = filter.query.trim().toLowerCase();
  const rows = invoices
    .filter(
      (i) =>
        (!filter.carrier ||
          (filter.carrier === "none"
            ? !i.costCarrier
            : i.costCarrier === filter.carrier)) &&
        (!filter.category || i.category === filter.category),
    )
    .flatMap((i) => i.lines.map((l) => ({ ...l, invoice: i })))
    .filter(
      (r) =>
        !q ||
        [r.name, r.invoice.supplier, r.invoice.number, r.invoice.costCarrier]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q)),
    );
  const carriers = [
    ...new Set(invoices.map((i) => i.costCarrier).filter(Boolean)),
  ];
  const categories = [
    ...new Set(invoices.map((i) => i.category).filter(Boolean)),
  ];
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
          {carriers.map((c) => (
            <option key={c}>{c}</option>
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
          {categories.map((k) => (
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
              <TableHead numeric>Nettó</TableHead>
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
                    {date(r.invoice.issueDate)}
                  </TableCell>
                  <TableCell>{r.invoice.supplier ?? "—"}</TableCell>
                  <TableCell>
                    <Mono>{r.invoice.number ?? "—"}</Mono>
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.invoice.category ?? "—"}</TableCell>
                  <TableCell numeric>{huf(r.net)}</TableCell>
                  <TableCell numeric>{huf(r.gross)}</TableCell>
                  <TableCell>
                    {r.invoice.costCarrier ?? <i>besorolatlan</i>}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusPill invoice={r.invoice} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  Nincs a szűrésnek megfelelő tétel.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        {rows.length} tétel · nettó {ft(sumOf(rows.map((r) => r.net)))} · bruttó{" "}
        {ft(sumOf(rows.map((r) => r.gross)))}
      </Small>
    </>
  );
}

function CarriersView() {
  const { invoices, carriers } = usePortal();
  const total = (name: string | null) => {
    const own = invoices.filter((i) => i.costCarrier === name);
    return { count: own.length, gross: sumOf(own.map((i) => i.gross)) };
  };
  const unassigned = total(null);
  return (
    <>
      <Panel className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Költségviselő</TableHead>
              <TableHead>Típus</TableHead>
              <TableHead>Adatok</TableHead>
              <TableHead numeric>Számlák</TableHead>
              <TableHead numeric>Bruttó összesen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carriers.map((c) => {
              const t = total(c.name);
              return (
                <TableRow key={`${c.type}-${c.name}`}>
                  <TableCell>
                    <b>{c.name}</b>
                  </TableCell>
                  <TableCell>
                    {c.type === "vehicle" ? "Jármű" : "Gép"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.detail ?? "—"}
                  </TableCell>
                  <TableCell numeric>{t.count}</TableCell>
                  <TableCell numeric>{ft(t.gross)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell>
                <i>Besorolatlan</i>
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell />
              <TableCell numeric>{unassigned.count}</TableCell>
              <TableCell numeric>{ft(unassigned.gross)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        A járművek és gépek a jármű- és géptörzsből jönnek ({carriers.length}{" "}
        tétel).
      </Small>
    </>
  );
}

async function uploadFiles(files: File[]) {
  for (const f of files) {
    setState({ uploading: state.uploading + 1 });
    try {
      const form = new FormData();
      form.append("file", f);
      const inv = await api<InvoiceDto>("invoices", {
        method: "POST",
        body: form,
      });
      replaceInvoice(inv);
      setState({ selected: inv.id });
      toast(
        inv.status === "assigned"
          ? `${f.name}: feldolgozva, költségviselő ${inv.costCarrier}`
          : `${f.name}: feldolgozva, ellenőrzésre vár`,
      );
    } catch (e) {
      toast(`${f.name}: ${(e as Error).message}`);
    } finally {
      setState({ uploading: state.uploading - 1 });
    }
  }
}

function UploadView() {
  const { uploading } = usePortal();
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={uploading > 0}
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void uploadFiles([...e.dataTransfer.files]);
        }}
        className="mb-4 w-full cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-7 text-center text-muted-foreground outline-ring hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait"
      >
        {uploading > 0
          ? "Feldolgozás… (fájlonként kb. fél perc)"
          : "Húzza ide a szkennelt számlát vagy fotót (PDF, JPG, PNG, legfeljebb 10 MB), vagy kattintson."}
        <Small className="mt-1">
          A fájl a tárhelyen a számla kelte szerinti ÉV-HÓNAP mappába kerül.
        </Small>
      </button>
      <input
        ref={file}
        type="file"
        hidden
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          void uploadFiles([...(e.currentTarget.files ?? [])]);
          e.currentTarget.value = "";
        }}
      />
    </>
  );
}
