"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Btn, Field, Grid, Inp, Panel, Row, Small } from "@/prototype/ui";

// Customers and products for the Mérleg screen (T-006 part). No delete: inactive rows stay
// because old weigh tickets point at them.

export interface MasterField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

type MasterRow = { id: string; active: boolean } & Record<string, unknown>;

const cell = (v: unknown) => (v == null || v === "" ? "—" : String(v));

/** Saves through the API; returns false (and shows the API's message) on failure. */
async function save(path: string, method: "POST" | "PATCH", body: object) {
  try {
    await api(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

const formBody = (form: HTMLFormElement, fields: MasterField[]) => {
  const f = new FormData(form);
  return Object.fromEntries(
    fields.map((x) => [x.key, String(f.get(x.key) ?? "").trim()]),
  );
};

function Fields({ fields, row }: { fields: MasterField[]; row?: MasterRow }) {
  return (
    <Grid cols={2}>
      {fields.map((x) => (
        <Field key={x.key} label={x.label}>
          <Inp
            name={x.key}
            required={x.required}
            placeholder={x.placeholder}
            defaultValue={row ? cell(row[x.key]).replace("—", "") : undefined}
            autoComplete="off"
          />
        </Field>
      ))}
    </Grid>
  );
}

export function MasterDataTab<T extends MasterRow>({
  title,
  path,
  fields,
  rows,
  onChanged,
}: {
  title: string;
  path: "customers" | "products";
  fields: MasterField[];
  rows: T[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (ok: Promise<boolean>, done: string) => {
    setBusy(true);
    const success = await ok;
    setBusy(false);
    if (success) {
      toast(done);
      await onChanged();
    }
    return success;
  };
  return (
    <>
      <Panel className="mb-3.5">
        <h2 className="mb-3">Új {title.toLowerCase()}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (await run(save(path, "POST", formBody(form, fields)), "Mentve"))
              form.reset();
          }}
        >
          <Fields fields={fields} />
          <Row className="mt-3">
            <Btn kind="pri" type="submit" disabled={busy}>
              Hozzáadás
            </Btn>
          </Row>
        </form>
      </Panel>
      <Panel className="p-0">
        <h2 className="border-b border-border px-4 py-3">
          {title} ({rows.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((x) => (
                <TableHead key={x.key}>{x.label}</TableHead>
              ))}
              <TableHead>Állapot</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {fields.map((x) => (
                    <TableCell key={x.key}>{cell(r[x.key])}</TableCell>
                  ))}
                  <TableCell>
                    {r.active ? (
                      <Pill tone="success">Aktív</Pill>
                    ) : (
                      <Pill tone="neutral">Inaktív</Pill>
                    )}
                  </TableCell>
                  <TableCell>
                    <Row className="flex-nowrap">
                      <Btn sm onClick={() => setEditing(r)}>
                        Szerkesztés
                      </Btn>
                      <Btn
                        sm
                        disabled={busy}
                        onClick={() =>
                          void run(
                            save(`${path}/${r.id}`, "PATCH", {
                              active: !r.active,
                            }),
                            r.active ? "Inaktiválva" : "Aktiválva",
                          )
                        }
                      >
                        {r.active ? "Inaktiválás" : "Aktiválás"}
                      </Btn>
                    </Row>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={fields.length + 2}
                  className="text-muted-foreground"
                >
                  Még nincs felvéve.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Small className="mt-1.5">
        Törölni nem lehet, mert a régi mérlegjegyek hivatkoznak rá; az inaktív
        tétel nem választható új mérlegelésnél.
      </Small>
      <Dialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Szerkesztés</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run(
                    save(
                      `${path}/${editing.id}`,
                      "PATCH",
                      formBody(e.currentTarget, fields),
                    ),
                    "Mentve",
                  )
                )
                  setEditing(null);
              }}
            >
              <Fields fields={fields} row={editing} />
              <DialogFooter className="mt-3">
                <Btn onClick={() => setEditing(null)}>Mégse</Btn>
                <Btn kind="pri" type="submit" disabled={busy}>
                  Mentés
                </Btn>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
