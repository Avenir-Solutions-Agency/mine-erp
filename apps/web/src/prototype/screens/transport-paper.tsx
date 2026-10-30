"use client";

import type { DocumentDto, PaperExtraction } from "@mine-erp/contracts";
import { useEffect, useRef, useState } from "react";
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
import { toast } from "@/components/ui/toast";
import { formatKg } from "@/lib/format";
import { api } from "@/prototype/api";
import { Alert, Btn, Panel, Row, Small } from "@/prototype/ui";
import { PaperReview, SURE } from "@/prototype/screens/transport-paper-review";

// Papír jegyek (T-010, T-011, T-016): photos of the paper weigh tickets and delivery notes of the
// temporary period. Each file is stored once, read by AI and reviewed by a person (T-017).

type Field = { value: string | number | null; confidence: number };

/** One read value; an uncertain one is marked so nobody takes it at face value. */
function Read({ f, show }: { f: Field; show?: (v: number) => string }) {
  if (f.value === null) return <span className="text-muted-foreground">—</span>;
  const text =
    typeof f.value === "number" && show ? show(f.value) : String(f.value);
  return f.confidence < SURE ? (
    <span
      className="rounded bg-warning-soft px-1 text-warning"
      title={`Bizonytalan olvasat (${Math.round(f.confidence * 100)}%)`}
    >
      {text}?
    </span>
  ) : (
    <span>{text}</span>
  );
}

const pending = (d: DocumentDto) =>
  d.status === "received" || d.status === "ingested";

function Status({ d }: { d: DocumentDto }) {
  if (d.status === "registered")
    return <Pill tone="success">Rögzítve · {d.registryNumber}</Pill>;
  if (d.status === "extracted")
    return <Pill tone="warning">Ellenőrzésre vár</Pill>;
  if (d.status === "unreadable")
    return <Pill tone="destructive">Nem olvasható, kézzel töltendő</Pill>;
  return <Pill tone="neutral">Feldolgozás…</Pill>;
}

const plates = (x: PaperExtraction) =>
  [x.plate.value, x.trailerPlate.value].filter(Boolean).join(" / ") || null;

const linkClass =
  "rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2";

export function TransportPaper() {
  const [rows, setRows] = useState<DocumentDto[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  const [reviewing, setReviewing] = useState<DocumentDto | null>(null);
  const [reloads, setReloads] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  const waiting = (rows ?? []).some(pending);
  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      void api<DocumentDto[]>("documents", { cache: "no-store" })
        .then((r) => live && setRows(r))
        .catch((e: Error) => live && setError(e.message));
    };
    load();
    // Reading a photo takes up to a minute. Always poll (a stale answer racing an upload could
    // otherwise stop it early), but slowly when nothing is in progress.
    const timer = setInterval(load, waiting ? 3000 : 15_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [waiting, reloads]);

  const upload = async (files: File[]) => {
    for (const f of files) {
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", f);
        const d = await api<DocumentDto>("documents", {
          method: "POST",
          body: form,
        });
        setRows((r) => [d, ...(r ?? [])]);
        toast(`${f.name}: feltöltve`);
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  if (error) return <Alert lvl="bad">{error}</Alert>;
  return (
    <>
      <button
        type="button"
        disabled={uploading > 0}
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload([...e.dataTransfer.files]);
        }}
        className="mb-4 w-full cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-7 text-center text-muted-foreground outline-ring hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait"
      >
        {uploading > 0
          ? "Feltöltés…"
          : "Húzza ide a mérlegjegy vagy szállítólevél fotóját (PDF, JPG, PNG, legfeljebb 10 MB), vagy kattintson."}
        <Small className="mt-1">
          Egy fájl egyszer tölthető fel; az eredeti változatlanul archiválódik.
        </Small>
      </button>
      <input
        ref={file}
        type="file"
        hidden
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          void upload([...(e.currentTarget.files ?? [])]);
          e.currentTarget.value = "";
        }}
      />
      {rows === null ? (
        <Small>Betöltés…</Small>
      ) : rows.length === 0 ? (
        <EmptyState message="Még nincs feltöltött papír jegy." />
      ) : (
        <Panel className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mérlegjegy</TableHead>
                <TableHead>Rendszám</TableHead>
                <TableHead>Vevő · anyag</TableHead>
                <TableHead numeric>Nettó</TableHead>
                <TableHead>EKÁER</TableHead>
                <TableHead>Szállítólevél</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const x = d.extraction;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      {x ? <Read f={x.ticketNumber} /> : null}
                      <Small className="break-all">
                        {x?.weighedAt.value ?? d.fileName}
                      </Small>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {x ? (
                        <Read
                          f={{
                            value: plates(x),
                            confidence: Math.min(
                              x.plate.confidence,
                              x.trailerPlate.confidence,
                            ),
                          }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {x ? (
                        <>
                          <Read f={x.customer} />
                          <Small>
                            <Read f={x.product} />
                          </Small>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell numeric>
                      {x ? <Read f={x.netKg} show={formatKg} /> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {x ? <Read f={x.ekaerNumber} /> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {x ? <Read f={x.deliveryNoteNumber} /> : null}
                    </TableCell>
                    <TableCell>
                      <Status d={d} />
                    </TableCell>
                    <TableCell>
                      <Row className="flex-nowrap">
                        {d.status === "extracted" ||
                        d.status === "unreadable" ? (
                          <Btn sm kind="pri" onClick={() => setReviewing(d)}>
                            Ellenőrzés
                          </Btn>
                        ) : null}
                        <a
                          href={`/api/erp/documents/${d.id}/file?raw=1`}
                          target="_blank"
                          rel="noopener"
                          className={linkClass}
                        >
                          Fotó
                        </a>
                      </Row>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
      {reviewing ? (
        <PaperReview
          doc={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            setReloads((n) => n + 1);
          }}
        />
      ) : null}
    </>
  );
}
