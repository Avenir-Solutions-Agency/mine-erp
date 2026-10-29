"use client";

import type { ShipmentReportDto } from "@mine-erp/contracts";
import { useEffect, useState } from "react";
import { Kpi } from "@/components/ui/kpi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKg } from "@/lib/format";
import { api } from "@/prototype/api";
import { Alert, Field, Grid, Inp, Panel, Row, Small } from "@/prototype/ui";

// Összesítő: shipments of a date range by customer and product, and the Excel file for the
// accountant (T-036). Cancelled shipments are listed in the file but not counted.

const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const monthStart = () => `${today().slice(0, 8)}01`;

function Totals({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: ShipmentReportDto["byCustomer"];
}) {
  return (
    <Panel className="p-0">
      <h2 className="border-b border-border px-4 py-3">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            <TableHead numeric>Szállítás</TableHead>
            <TableHead numeric>Nettó</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((t) => (
              <TableRow key={t.key}>
                <TableCell>{t.key}</TableCell>
                <TableCell numeric>{t.count}</TableCell>
                <TableCell numeric className="font-semibold">
                  {formatKg(t.netKg)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Nincs szállítás az időszakban.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}

export function TransportSummary() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<ShipmentReportDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api<ShipmentReportDto>(`reports/shipments?from=${from}&to=${to}`)
      .then((r) => {
        if (!live) return;
        setReport(r);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [from, to]);

  return (
    <>
      <Row className="mb-3.5 items-end">
        <Field label="Ettől">
          <Inp
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.currentTarget.value)}
          />
        </Field>
        <Field label="Eddig">
          <Inp
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.currentTarget.value)}
          />
        </Field>
        <a
          href={`/api/erp/reports/shipments.xlsx?from=${from}&to=${to}`}
          className="rounded-lg border border-border bg-primary px-3 py-1.5 text-control font-semibold text-primary-foreground outline-ring hover:opacity-90 focus-visible:outline-2"
        >
          Excel letöltése
        </a>
      </Row>
      {error ? (
        <Alert lvl="bad">{error}</Alert>
      ) : !report ? (
        <Small>Betöltés…</Small>
      ) : (
        <>
          <Grid cols={3} className="mb-3.5">
            <Kpi label="Szállítás" value={report.total.count} />
            <Kpi label="Nettó összesen" value={formatKg(report.total.netKg)} />
            <Kpi
              label="Sztornó (nem számít bele)"
              value={report.rows.filter((r) => r.status === "cancelled").length}
            />
          </Grid>
          <div className="grid gap-3.5 lg:grid-cols-2">
            <Totals
              title="Vevők szerint"
              label="Vevő"
              rows={report.byCustomer}
            />
            <Totals
              title="Termékek szerint"
              label="Termék"
              rows={report.byProduct}
            />
          </div>
          <Small className="mt-1.5">
            Az Excel három lapot tartalmaz: Szállítások (minden sor, a
            sztornózottak jelölve), Vevők szerint, Termékek szerint.
          </Small>
        </>
      )}
    </>
  );
}
