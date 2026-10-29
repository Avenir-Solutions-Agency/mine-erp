"use client";

import type {
  CarrierDto,
  CustomerDto,
  ProductDto,
  ScaleLiveDto,
  WeighingDto,
} from "@mine-erp/contracts";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
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
import { formatKg } from "@/lib/format";
import { api, ApiFailure } from "@/prototype/api";
import {
  Alert,
  Btn,
  Field,
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
import {
  MasterDataTab,
  type MasterField,
} from "@/prototype/screens/scale-master-data";

// Mérleg: the ERP's own weighbridge screen (decided 2026-10-29). The weight always comes from
// the scale agent through the API; nobody types a weight here.
// State lives outside React, as in billing-inbound: Screen remounts views on every engine render.
type ScaleState = {
  load: "idle" | "loading" | "ready" | "error" | "login";
  error: string;
  weighings: WeighingDto[];
  vehicles: CarrierDto[];
  customers: CustomerDto[];
  products: ProductDto[];
  view: string;
  live: ScaleLiveDto | null;
};
let state: ScaleState = {
  load: "idle",
  error: "",
  weighings: [],
  vehicles: [],
  live: null,
  customers: [],
  products: [],
  view: "weigh",
};
const listeners = new Set<() => void>();
function setState(patch: Partial<ScaleState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** Live weight is polled twice a second while the screen is open, and stops when it closes. */
let poller: ReturnType<typeof setInterval> | null = null;
const pollLive = () =>
  api<ScaleLiveDto>("scale/live")
    .then((live) => setState({ live }))
    .catch(() => setState({ live: null }));
function subscribe(l: () => void) {
  listeners.add(l);
  poller ??= setInterval(() => {
    if (state.load === "ready") void pollLive();
  }, 500);
  return () => {
    listeners.delete(l);
    if (!listeners.size && poller) {
      clearInterval(poller);
      poller = null;
    }
  };
}
const useScale = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );

async function reload() {
  if (state.load === "idle") setState({ load: "loading" });
  try {
    const [weighings, carriers, customers, products] = await Promise.all([
      api<WeighingDto[]>("weighings"),
      api<CarrierDto[]>("carriers"),
      api<CustomerDto[]>("customers"),
      api<ProductDto[]>("products"),
    ]);
    setState({
      load: "ready",
      weighings,
      vehicles: carriers.filter((x) => x.type === "vehicle"),
      customers,
      products,
    });
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401)
      setState({ load: "login" });
    else setState({ load: "error", error: (e as Error).message });
  }
}

const VIEWS: [string, string][] = [
  ["weigh", "Mérlegelés"],
  ["customers", "Vevők"],
  ["products", "Termékek"],
];
const CUSTOMER_FIELDS: MasterField[] = [
  { key: "name", label: "Név", required: true },
  { key: "taxNumber", label: "Adószám", placeholder: "12345678-1-12" },
  { key: "address", label: "Cím" },
  { key: "note", label: "Megjegyzés" },
];
const PRODUCT_FIELDS: MasterField[] = [
  {
    key: "name",
    label: "Név",
    required: true,
    placeholder: "pl. Zúzottkő 22/63",
  },
  { key: "fractionCode", label: "Frakció", placeholder: "22/63" },
  { key: "vtsz", label: "VTSZ", placeholder: "2517" },
  { key: "note", label: "Megjegyzés" },
];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });
const isToday = (iso: string) =>
  new Date(iso).toDateString() === new Date().toDateString();

export function ScaleScreen() {
  const { load, error, weighings, vehicles, live, customers, products, view } =
    useScale();
  useEffect(() => {
    if (state.load === "idle") void reload();
  }, []);

  /** Runs one weighing action; the API refuses unstable weights with a Hungarian message. */
  const act = async (path: string, body: object, done: string) => {
    try {
      const w = await api<WeighingDto>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      toast(`${w.ticketNumber}: ${done}`);
      await reload();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  };

  const today = weighings.filter((w) => isToday(w.firstAt));
  const open = weighings.filter((w) => w.status === "open");
  const closed = today.filter((w) => w.status !== "open");
  const netToday = today
    .filter((w) => w.status === "completed")
    .reduce((a, w) => a + (w.netKg ?? 0), 0);

  return (
    <>
      <Head
        title="Mérleg"
        sub="Az élő súly a mérlegfejből jön, kézzel senki nem ír be tömeget. Első mérés a behajtáskor, második a kihajtáskor; mentett tárával egy mérés is elég."
      />
      {load === "idle" || load === "loading" ? (
        <Small>Betöltés…</Small>
      ) : load === "login" ? (
        <Alert lvl="warn">
          A mérlegeléshez{" "}
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
          <TabBar
            items={VIEWS}
            active={view}
            onSelect={(v) => setState({ view: v })}
          />
          {view === "customers" ? (
            <MasterDataTab
              title="Vevők"
              path="customers"
              fields={CUSTOMER_FIELDS}
              rows={customers}
              onChanged={reload}
            />
          ) : view === "products" ? (
            <MasterDataTab
              title="Termékek"
              path="products"
              fields={PRODUCT_FIELDS}
              rows={products}
              onChanged={reload}
            />
          ) : (
            <>
              <Grid cols={3} className="mb-3.5">
                <Kpi
                  label="Ma lezárva"
                  value={today.filter((w) => w.status === "completed").length}
                />
                <Kpi label="Ma nettó összesen" value={formatKg(netToday)} />
                <Kpi label="Nyitott mérlegelés" value={open.length} />
              </Grid>
              <div className="mb-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <LiveWeight live={live} />
                <FirstWeighingForm
                  vehicles={vehicles}
                  customers={customers.filter((c) => c.active)}
                  products={products.filter((p) => p.active)}
                  stable={live?.stableKg != null}
                  onSubmit={(body) =>
                    act("weighings", body, "első mérés rögzítve")
                  }
                />
              </div>
              <OpenWeighings
                open={open}
                stable={live?.stableKg != null}
                onSecond={(w) =>
                  void act(`weighings/${w.id}/second`, {}, "lezárva")
                }
                onVoid={(w, reason) =>
                  act(`weighings/${w.id}/void`, { reason }, "sztornózva")
                }
              />
              <ClosedToday
                rows={closed}
                onVoid={(w, reason) =>
                  act(`weighings/${w.id}/void`, { reason }, "sztornózva")
                }
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function LiveWeight({ live }: { live: ScaleLiveDto | null }) {
  const state = !live?.online
    ? "offline"
    : live.stableKg != null
      ? "stable"
      : "moving";
  return (
    <Panel>
      <div className="flex items-start justify-between gap-2">
        <h2>Élő súly</h2>
        {state === "stable" ? (
          <Pill tone="success">Stabil</Pill>
        ) : state === "moving" ? (
          <Pill tone="warning">Mozgásban</Pill>
        ) : (
          <Pill tone="destructive">Nincs jel</Pill>
        )}
      </div>
      <output
        aria-live="polite"
        className="font-display mt-3 block text-5xl font-semibold tabular-nums sm:text-6xl"
      >
        {live?.kg != null ? formatKg(live.kg) : "—"}
      </output>
      <Small className="mt-2">
        {state === "offline"
          ? "A mérleg nem küld adatot. Ellenőrizze a mérlegfejet és a scale agentet."
          : state === "moving"
            ? "Mérni csak stabil súlynál lehet (3 mp nyugalom)."
            : "A súly rögzíthető."}
      </Small>
    </Panel>
  );
}

function FirstWeighingForm({
  vehicles,
  customers,
  products,
  stable,
  onSubmit,
}: {
  vehicles: CarrierDto[];
  customers: CustomerDto[];
  products: ProductDto[];
  stable: boolean;
  onSubmit: (body: object) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Panel>
      <h2 className="mb-3">Új mérlegelés</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const text = (k: string) => String(f.get(k) ?? "").trim() || null;
          setBusy(true);
          const ok = await onSubmit({
            plate: text("plate") ?? "",
            trailerPlate: text("trailerPlate"),
            productId: text("productId"),
            customerId: text("customerId"),
            note: text("note"),
            useSavedTare: f.get("useSavedTare") === "on",
          });
          setBusy(false);
          if (ok) form.reset();
        }}
      >
        <Grid cols={2}>
          <Field label="Rendszám">
            <Inp name="plate" list="scale-plates" required autoComplete="off" />
          </Field>
          <Field label="Pótkocsi">
            <Inp name="trailerPlate" autoComplete="off" />
          </Field>
          <Field label="Termék">
            <Sel name="productId" defaultValue="">
              <option value="">
                {products.length ? "Válasszon…" : "Nincs termék (Termékek fül)"}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.fractionCode ? ` (${p.fractionCode})` : ""}
                </option>
              ))}
            </Sel>
          </Field>
          <Field label="Vevő">
            <Sel name="customerId" defaultValue="">
              <option value="">
                {customers.length ? "Válasszon…" : "Nincs vevő (Vevők fül)"}
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Sel>
          </Field>
        </Grid>
        <Field label="Megjegyzés" className="mt-3">
          <Inp name="note" />
        </Field>
        <datalist id="scale-plates">
          {vehicles.map((v) => (
            <option key={v.name} value={v.name}>
              {v.detail ?? ""}
            </option>
          ))}
        </datalist>
        <Row className="mt-3">
          <label className="flex items-center gap-2 text-control">
            <input type="checkbox" name="useSavedTare" className="size-4" />
            Mentett tárával (egy mérés)
          </label>
          <Btn kind="pri" type="submit" disabled={!stable || busy}>
            {busy ? "Rögzítés…" : "Első mérés"}
          </Btn>
        </Row>
      </form>
    </Panel>
  );
}

function OpenWeighings({
  open,
  stable,
  onSecond,
  onVoid,
}: {
  open: WeighingDto[];
  stable: boolean;
  onSecond: (w: WeighingDto) => void;
  onVoid: (w: WeighingDto, reason: string) => Promise<boolean>;
}) {
  return (
    <Panel className="mb-3.5 p-0">
      <h2 className="border-b border-border px-4 py-3">Nyitott mérlegelések</h2>
      {open.length ? (
        <ul>
          {open.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <div>
                <b>{w.plate}</b> · <Mono>{w.ticketNumber}</Mono>
                <Small>
                  {time(w.firstAt)} · első mérés {formatKg(w.firstKg)}
                  {w.material ? ` · ${w.material}` : ""}
                  {w.customer ? ` · ${w.customer}` : ""}
                </Small>
              </div>
              <Row>
                <Btn kind="pri" disabled={!stable} onClick={() => onSecond(w)}>
                  Második mérés
                </Btn>
                <VoidButton weighing={w} onVoid={onVoid} />
              </Row>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="Nincs nyitott mérlegelés." />
      )}
    </Panel>
  );
}

function ClosedToday({
  rows,
  onVoid,
}: {
  rows: WeighingDto[];
  onVoid: (w: WeighingDto, reason: string) => Promise<boolean>;
}) {
  return (
    <Panel className="p-0">
      <h2 className="border-b border-border px-4 py-3">Mai mérlegjegyek</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mérlegjegy</TableHead>
            <TableHead>Idő</TableHead>
            <TableHead>Rendszám</TableHead>
            <TableHead>Anyag</TableHead>
            <TableHead>Vevő</TableHead>
            <TableHead numeric>Bruttó</TableHead>
            <TableHead numeric>Tára</TableHead>
            <TableHead numeric>Nettó</TableHead>
            <TableHead>Állapot</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <Mono>{w.ticketNumber}</Mono>
                </TableCell>
                <TableCell>{time(w.secondAt ?? w.firstAt)}</TableCell>
                <TableCell>{w.plate}</TableCell>
                <TableCell>{w.material ?? "—"}</TableCell>
                <TableCell>{w.customer ?? "—"}</TableCell>
                <TableCell numeric>
                  {w.grossKg != null ? formatKg(w.grossKg) : "—"}
                </TableCell>
                <TableCell numeric>
                  {w.tareKg != null ? formatKg(w.tareKg) : "—"}
                  {w.savedTare ? <Small>mentett</Small> : null}
                </TableCell>
                <TableCell numeric className="font-semibold">
                  {w.netKg != null ? formatKg(w.netKg) : "—"}
                </TableCell>
                <TableCell>
                  {w.status === "void" ? (
                    <span title={w.voidReason ?? undefined}>
                      <Pill tone="destructive">Sztornó</Pill>
                    </span>
                  ) : (
                    <Pill tone="success">Lezárva</Pill>
                  )}
                </TableCell>
                <TableCell>
                  <Row className="flex-nowrap">
                    <a
                      href={`/api/erp/weighings/${w.id}/ticket`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2"
                    >
                      Mérlegjegy
                    </a>
                    {w.status === "completed" ? (
                      <VoidButton weighing={w} onVoid={onVoid} />
                    ) : null}
                  </Row>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground">
                Ma még nincs lezárt mérlegelés.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** Void needs a reason; the record stays in the list as Sztornó. */
function VoidButton({
  weighing,
  onVoid,
}: {
  weighing: WeighingDto;
  onVoid: (w: WeighingDto, reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Btn sm kind="bad" onClick={() => setOpen(true)}>
        Sztornó
      </Btn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sztornó · {weighing.ticketNumber}</DialogTitle>
          </DialogHeader>
          <p>
            A mérlegjegy nem törlődik, sztornózott állapotba kerül az
            indoklással együtt.
          </p>
          <Field label="Indoklás">
            <Inp
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="pl. rossz rendszám"
            />
          </Field>
          <DialogFooter>
            <Btn onClick={() => setOpen(false)}>Mégse</Btn>
            <Btn
              kind="bad"
              disabled={!reason.trim() || busy}
              onClick={async () => {
                setBusy(true);
                if (await onVoid(weighing, reason)) {
                  setOpen(false);
                  setReason("");
                }
                setBusy(false);
              }}
            >
              {busy ? "Sztornózás…" : "Sztornó"}
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
