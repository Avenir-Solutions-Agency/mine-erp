"use client";

import type { DocumentDto } from "@mine-erp/contracts";
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
import { api } from "@/prototype/api";
import { Alert, Panel, Small } from "@/prototype/ui";

// Papír jegyek (T-010, T-016): photos of the paper weigh tickets and delivery notes of the
// temporary period. Each file is stored once; reading them out comes with T-011.

const linkClass =
  "rounded-lg border border-border px-2 py-1 text-xs whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2";

export function TransportPaper() {
  const [rows, setRows] = useState<DocumentDto[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    api<DocumentDto[]>("documents")
      .then((r) => live && setRows(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

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
                <TableHead>Feltöltve</TableHead>
                <TableHead>Fájl</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleString("hu-HU")}
                  </TableCell>
                  <TableCell className="break-all">{d.fileName}</TableCell>
                  <TableCell>
                    {d.status === "ingested" ? (
                      <Pill tone="success">Átvéve</Pill>
                    ) : (
                      <Pill tone="warning">Feldolgozásra vár</Pill>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/api/erp/documents/${d.id}/file?raw=1`}
                      target="_blank"
                      rel="noopener"
                      className={linkClass}
                    >
                      Megnyitás
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </>
  );
}
