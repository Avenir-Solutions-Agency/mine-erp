"use client";

import type { ShipmentDto } from "@mine-erp/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Alert, Head, Inp, Mono, Panel, Small } from "@/prototype/ui";

// Szállítólevelek: one delivery note per registered shipment (number = SZ number), issued as an
// archived PDF. The demo screen is gone.

const linkClass =
  "rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2";

export function DnScreen() {
  const [rows, setRows] = useState<ShipmentDto[] | null>(null);
  const [state, setState] = useState("ok");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    api<ShipmentDto[]>("shipments")
      .then((r) => live && setRows(r))
      .catch(
        (e: unknown) =>
          live &&
          setState(
            e instanceof ApiFailure && e.status === 401
              ? "login"
              : (e as Error).message,
          ),
      );
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (s) =>
      !q ||
      [s.registryNumber, s.plate, s.customer, s.product].some((v) =>
        v.toLowerCase().includes(q),
      ),
  );

  return (
    <>
      <Head
        title="Szállítólevelek"
        sub="Minden nyilvántartott szállításhoz egy szállítólevél tartozik, a száma a szállítás SZ-száma. A PDF egyszer készül el és archiválódik; sztornónál külön bélyegzős példány jön."
      />
      {state === "login" ? (
        <Alert lvl="warn">
          A szállítólevelekhez{" "}
          <Link href="/login/mfa" className="font-semibold underline">
            jelentkezzen be
          </Link>
          .
        </Alert>
      ) : state !== "ok" ? (
        <Alert lvl="bad">{state}</Alert>
      ) : rows === null ? (
        <Small>Betöltés…</Small>
      ) : rows.length === 0 ? (
        <EmptyState message="Még nincs szállítólevél. Egy nyilvántartott szállítás után itt jelenik meg." />
      ) : (
        <>
          <Inp
            aria-label="Keresés"
            placeholder="Keresés: SZ-szám, rendszám, vevő, termék…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="mb-3 w-full"
          />
          <Panel className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Szám</TableHead>
                  <TableHead>Kelt</TableHead>
                  <TableHead>Vevő</TableHead>
                  <TableHead>Termék</TableHead>
                  <TableHead numeric>Nettó</TableHead>
                  <TableHead>Rendszám</TableHead>
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
                      {new Date(s.shippedAt).toLocaleDateString("hu-HU")}
                    </TableCell>
                    <TableCell>{s.customer}</TableCell>
                    <TableCell>{s.product}</TableCell>
                    <TableCell numeric>{formatKg(s.netKg)}</TableCell>
                    <TableCell>{s.plate}</TableCell>
                    <TableCell>
                      {s.status === "registered" ? (
                        <Pill tone="success">Kiállítva</Pill>
                      ) : (
                        <Pill tone="destructive">Sztornó</Pill>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/api/erp/shipments/${s.id}/delivery-note`}
                        target="_blank"
                        rel="noopener"
                        className={linkClass}
                      >
                        Szállítólevél
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </>
      )}
    </>
  );
}
