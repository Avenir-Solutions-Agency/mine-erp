"use client";

import type { WeighingDto } from "@mine-erp/contracts";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { api } from "@/prototype/api";
import { Btn, Field, Inp, Mono, Row, Small } from "@/prototype/ui";

// EKÁER for one weighing (T-014): status, filing with planned weight and value, deletion with a
// reason. NAV is called by the worker; this only starts it and shows the result.

async function post(path: string, body: object) {
  try {
    await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

export function EkaerStatus({ ekaer }: { ekaer: WeighingDto["ekaer"] }) {
  if (!ekaer) return <Small>—</Small>;
  if (ekaer.status === "active")
    return (
      <span className="flex flex-col gap-0.5">
        <Pill tone="success">Bejelentve</Pill>
        <Mono>{ekaer.tcn}</Mono>
        {ekaer.error ? <Small>{ekaer.error}</Small> : null}
      </span>
    );
  if (ekaer.status === "pending")
    return <Pill tone="warning">Bejelentés folyamatban</Pill>;
  if (ekaer.status === "deleting")
    return <Pill tone="warning">Törlés folyamatban</Pill>;
  if (ekaer.status === "deleted") return <Pill tone="neutral">Törölve</Pill>;
  return (
    <span className="flex flex-col gap-0.5" title={ekaer.error ?? undefined}>
      <Pill tone="destructive">Sikertelen</Pill>
      {ekaer.error ? <Small>{ekaer.error}</Small> : null}
    </span>
  );
}

/** "EKÁER bejelentés" or "EKÁER törlés", depending on the weighing's latest report. */
export function EkaerActions({
  weighing: w,
  onChanged,
}: {
  weighing: WeighingDto;
  onChanged: () => Promise<void>;
}) {
  const [dialog, setDialog] = useState<"file" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const live =
    w.ekaer && ["pending", "active", "deleting"].includes(w.ekaer.status);
  if (w.status === "void" || (live && w.ekaer!.status !== "active"))
    return null;

  const submit = async (path: string, body: object, done: string) => {
    setBusy(true);
    const ok = await post(path, body);
    setBusy(false);
    if (!ok) return;
    toast(done);
    setDialog(null);
    await onChanged();
  };

  return (
    <>
      {live ? (
        <Btn sm kind="bad" onClick={() => setDialog("delete")}>
          EKÁER törlés
        </Btn>
      ) : (
        <Btn sm kind="ai" onClick={() => setDialog("file")}>
          EKÁER bejelentés
        </Btn>
      )}
      <Dialog
        open={dialog === "file"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>EKÁER bejelentés · {w.ticketNumber}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void submit(
                `weighings/${w.id}/ekaer`,
                {
                  plannedKg: Number(f.get("plannedKg")),
                  valueHuf: Number(f.get("valueHuf")),
                },
                "EKÁER-bejelentés elindítva",
              );
            }}
          >
            <p className="mb-3">
              {w.plate} · {w.material ?? "nincs termék"} ·{" "}
              {w.customer ?? "nincs vevő"}. A bejelentés indulás előtt megy ki,
              ezért a tervezett tömeggel; a pontos nettót a második mérés adja.
            </p>
            <Row>
              <Field label="Tervezett tömeg (kg)">
                <Inp
                  name="plannedKg"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={w.netKg ?? undefined}
                />
              </Field>
              <Field label="Érték (Ft)">
                <Inp name="valueHuf" type="number" min={1} step={1} required />
              </Field>
            </Row>
            <DialogFooter className="mt-3">
              <Btn onClick={() => setDialog(null)}>Mégse</Btn>
              <Btn kind="pri" type="submit" disabled={busy}>
                {busy ? "Indítás…" : "Bejelentés"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>EKÁER törlés · {w.ekaer?.tcn}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason") ?? "",
              );
              void submit(
                `weighings/${w.id}/ekaer/delete`,
                { reason },
                "EKÁER-törlés elindítva",
              );
            }}
          >
            <p className="mb-3">
              A NAV-nál a bejelentés inaktív lesz. Az indoklás a NAV-hoz is
              elmegy, és bekerül a naplóba.
            </p>
            <Field label="Indoklás">
              <Inp
                name="reason"
                minLength={3}
                maxLength={200}
                required
                placeholder="pl. a fuvar elmaradt"
              />
            </Field>
            <DialogFooter className="mt-3">
              <Btn onClick={() => setDialog(null)}>Mégse</Btn>
              <Btn kind="bad" type="submit" disabled={busy}>
                {busy ? "Indítás…" : "Törlés"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
