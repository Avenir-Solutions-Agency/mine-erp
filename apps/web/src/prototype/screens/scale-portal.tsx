"use client";

import type { PortalWeighingDto } from "@mine-erp/contracts";
import { useEffect, useState } from "react";
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
import { api } from "@/prototype/api";
import { Alert, Panel, Small } from "@/prototype/ui";

// Weighings the PORTAL AI scale program saved, copied by the mérleg-híd on the scale PC
// (apps/scale-agent). Read only: PORTAL AI is where they are made and changed.

const REFRESH_MS = 5000;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("hu-HU", {
        timeZone: "Europe/Budapest",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const kg = (v: number | null) => (v == null ? "—" : formatKg(v));
const or = (v: string | null) => v || "—";

const STATUS = {
  open: <Pill tone="warning">A mérlegen</Pill>,
  completed: <Pill tone="success">Lezárt</Pill>,
  void: <Pill tone="neutral">Stornó</Pill>,
} as const;

export function PortalWeighings() {
  const [rows, setRows] = useState<PortalWeighingDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      api<PortalWeighingDto[]>("portal-weighings")
        .then((r) => {
          if (!live) return;
          setRows(r);
          setError(null);
        })
        .catch((e: unknown) => live && setError((e as Error).message));
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  if (error && !rows) return <Alert lvl="bad">{error}</Alert>;
  if (!rows) return <p className="text-sm text-muted-foreground">Betöltés…</p>;
  const synced = rows.reduce<string | null>(
    (a, r) => (a && a > r.syncedAt ? a : r.syncedAt),
    null,
  );
  return (
    <>
      <Panel className="p-0">
        <h2 className="border-b border-border px-4 py-3">
          PORTAL AI mérések ({rows.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Állapot</TableHead>
              <TableHead>Mérlegjegy</TableHead>
              <TableHead>Rendszám</TableHead>
              <TableHead>Irány</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Anyag</TableHead>
              <TableHead className="text-right">Első mérés</TableHead>
              <TableHead className="text-right">Bruttó</TableHead>
              <TableHead className="text-right">Tára</TableHead>
              <TableHead className="text-right">Nettó</TableHead>
              <TableHead>Lezárva</TableHead>
              <TableHead>Sofőr / fuvarozó</TableHead>
              <TableHead>EKÁER</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{STATUS[w.status]}</TableCell>
                  <TableCell className="font-mono">
                    {or(w.ticketNumber)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {or(w.licensePlate)}
                    {w.trailerPlate ? <Small>{w.trailerPlate}</Small> : null}
                  </TableCell>
                  <TableCell>
                    {w.direction === "inbound"
                      ? "Be"
                      : w.direction === "outbound"
                        ? "Ki"
                        : "—"}
                  </TableCell>
                  <TableCell>{or(w.customerName)}</TableCell>
                  <TableCell>{or(w.materialName)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {kg(w.firstWeightKg)}
                    <Small>{when(w.firstMeasuredAt)}</Small>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {kg(w.grossKg)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {kg(w.tareKg)}
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {kg(w.netKg)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {when(w.completedAt)}
                  </TableCell>
                  <TableCell>
                    {or(w.driverName)}
                    {w.carrierName ? <Small>{w.carrierName}</Small> : null}
                  </TableCell>
                  <TableCell className="font-mono">
                    {or(w.ekaerNumber)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={13} className="text-muted-foreground">
                  Még nem érkezett mérés a PORTAL AI-ból. Indítsa el a
                  mérleg-hidat a mérlegházi gépen.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        {synced
          ? `Utolsó átvétel: ${when(synced)}. 5 másodpercenként frissül.`
          : "5 másodpercenként frissül."}
        {error ? ` Hiba a frissítésnél: ${error}` : ""} Itt nem lehet
        módosítani: a méréseket a PORTAL AI-ban kell javítani.
      </Small>
    </>
  );
}
