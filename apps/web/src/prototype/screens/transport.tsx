"use client";

import type { ShipmentDto } from "@mine-erp/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { formatKg } from "@/lib/format";
import { api, ApiFailure } from "@/prototype/api";
import {
  Alert,
  Btn,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Small,
  TabBar,
} from "@/prototype/ui";
import { TransportPaper } from "@/prototype/screens/transport-paper";
import { TransportRules } from "@/prototype/screens/transport-rules";
import { TransportSummary } from "@/prototype/screens/transport-summary";

// Fuvarok és EKÁER: the real shipment register (PRD F4, T-018). Every completed weighing with a
// customer and product is registered with a gapless SZ number; the demo transport screen is gone.

const when = (iso: string) =>
  new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function TransportScreen() {
  const [rows, setRows] = useState<ShipmentDto[] | null>(null);
  const [state, setState] = useState<"ok" | "login" | string>("ok");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");

  const load = () =>
    api<ShipmentDto[]>("shipments")
      .then((r) => {
        setRows(r);
        setState("ok");
      })
      .catch((e: unknown) =>
        setState(
          e instanceof ApiFailure && e.status === 401
            ? "login"
            : (e as Error).message,
        ),
      );
  useEffect(() => {
    void load();
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (s) =>
      !q ||
      [s.registryNumber, s.plate, s.customer, s.product, s.ekaerTcn ?? ""].some(
        (v) => v.toLowerCase().includes(q),
      ),
  );
  const live = (rows ?? []).filter((s) => s.status === "registered");
  const today = live.filter(
    (s) => new Date(s.shippedAt).toDateString() === new Date().toDateString(),
  );

  return (
    <>
      <Head
        title="Fuvarok és EKÁER"
        sub="A nyilvántartott szállítások: minden lezárt mérlegelés vevővel és termékkel hézagmentes SZ-számot kap. A sztornózott szállítás száma megmarad."
      />
      {state === "login" ? (
        <Alert lvl="warn">
          A nyilvántartáshoz{" "}
          <Link href="/login/mfa" className="font-semibold underline">
            jelentkezzen be
          </Link>
          .
        </Alert>
      ) : state !== "ok" ? (
        <Alert lvl="bad">
          {state}{" "}
          <Btn sm onClick={() => void load()}>
            Újra
          </Btn>
        </Alert>
      ) : rows === null ? (
        <Small>Betöltés…</Small>
      ) : (
        <>
          <TabBar
            items={[
              ["list", "Szállítások"],
              ["summary", "Összesítő és Excel"],
              ["paper", "Papír jegyek"],
              ["rules", "Szabályok"],
            ]}
            active={view}
            onSelect={setView}
          />
          {view === "rules" ? (
            <TransportRules />
          ) : view === "paper" ? (
            <TransportPaper />
          ) : view === "summary" ? (
            <TransportSummary />
          ) : (
            <>
              <Grid cols={3} className="mb-3.5">
                <Kpi label="Ma szállítva" value={today.length} />
                <Kpi
                  label="Ma nettó"
                  value={formatKg(today.reduce((a, s) => a + s.netKg, 0))}
                />
                <Kpi
                  label="EKÁER-szám nélkül"
                  value={live.filter((s) => !s.ekaerTcn).length}
                />
              </Grid>
              <Inp
                aria-label="Keresés"
                placeholder="Keresés: SZ-szám, rendszám, vevő, termék, EKÁER-szám…"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                className="mb-3 w-full"
              />
              <Panel className="p-0">
                {rows.length === 0 ? (
                  <EmptyState message="Még nincs nyilvántartott szállítás. Egy lezárt mérlegelés vevővel és termékkel automatikusan ide kerül." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Szám</TableHead>
                        <TableHead>Időpont</TableHead>
                        <TableHead>Rendszám</TableHead>
                        <TableHead>Vevő</TableHead>
                        <TableHead>Termék</TableHead>
                        <TableHead numeric>Nettó</TableHead>
                        <TableHead>EKÁER</TableHead>
                        <TableHead>Állapot</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Mono>{s.registryNumber}</Mono>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {when(s.shippedAt)}
                          </TableCell>
                          <TableCell>{s.plate}</TableCell>
                          <TableCell>{s.customer}</TableCell>
                          <TableCell>{s.product}</TableCell>
                          <TableCell numeric className="font-semibold">
                            {formatKg(s.netKg)}
                          </TableCell>
                          <TableCell>
                            {s.ekaerTcn ? (
                              <Mono>{s.ekaerTcn}</Mono>
                            ) : (
                              <Small>—</Small>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.status === "registered" ? (
                              <Pill tone="success">Nyilvántartva</Pill>
                            ) : (
                              <Pill tone="destructive">Sztornó</Pill>
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={`/api/erp/weighings/${s.weighingId}/ticket`}
                              target="_blank"
                              rel="noopener"
                              className="rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2"
                            >
                              Mérlegjegy
                            </a>{" "}
                            <a
                              href={`/api/erp/shipments/${s.id}/delivery-note`}
                              target="_blank"
                              rel="noopener"
                              className="rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2"
                            >
                              Szállítólevél
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Panel>
              <Small className="mt-1.5">
                {shown.length} szállítás · nettó{" "}
                {formatKg(
                  shown
                    .filter((s) => s.status === "registered")
                    .reduce((a, s) => a + s.netKg, 0),
                )}
              </Small>
            </>
          )}
        </>
      )}
    </>
  );
}
