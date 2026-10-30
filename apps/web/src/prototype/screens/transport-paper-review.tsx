"use client";

import type {
  CustomerDto,
  DocumentDto,
  PaperExtraction,
  ProductDto,
  RegisterDocumentInput,
} from "@mine-erp/contracts";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api } from "@/prototype/api";
import { Alert, Btn, Field, Grid, Inp, Row, Sel, Small } from "@/prototype/ui";

// Ellenőrzés (T-017): the photo next to the AI reading; a person confirms or corrects every field,
// then the ticket becomes a paper weighing and its shipment, and EKÁER is filed if it has no number.

/** Below this a reading is marked uncertain and must be looked at. */
export const SURE = 0.8;

type Reply = {
  registryNumber: string;
  ekaer: "printed" | "filed" | "none";
  warning: string | null;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** The master-data row whose name contains the read one (or the other way round). */
function match<T extends { id: string; name: string }>(
  rows: T[],
  read: string | null,
) {
  const r = read ? norm(read) : "";
  if (r.length < 3) return "";
  return (
    rows.find((x) => norm(x.name).includes(r) || r.includes(norm(x.name)))
      ?.id ?? ""
  );
}

/** "2026-10-26 08:49" → the datetime-local value "2026-10-26T08:49". */
const localInput = (v: string | null) => v?.replace(" ", "T") ?? "";

export function PaperReview({
  doc,
  onClose,
  onDone,
}: {
  doc: DocumentDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const x: PaperExtraction | null = doc.extraction;
  const [customers, setCustomers] = useState<CustomerDto[] | null>(null);
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [productId, setProductId] = useState("");
  const [grossKg, setGrossKg] = useState(x?.grossKg.value ?? 0);
  const [tareKg, setTareKg] = useState(x?.tareKg.value ?? 0);
  const [fileEkaer, setFileEkaer] = useState(!x?.ekaerNumber.value);

  useEffect(() => {
    let live = true;
    Promise.all([
      api<CustomerDto[]>("customers"),
      api<ProductDto[]>("products"),
    ])
      .then(([c, p]) => {
        if (!live) return;
        setCustomers(c.filter((r) => r.active));
        setProducts(p);
        setProductId(match(p, x?.product.value ?? null));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [x]);

  const product = products?.find((p) => p.id === productId);
  const netKg = grossKg - tareKg;
  const suggestedHuf =
    product?.pricePerTonneHuf && netKg > 0
      ? Math.round((netKg * product.pricePerTonneHuf) / 1000)
      : "";

  /** A label that warns when the AI was unsure of the value under it. */
  const label = (text: string, f?: { confidence: number }) =>
    f && f.confidence < SURE ? (
      <span className="text-warning">
        {text} · bizonytalan ({Math.round(f.confidence * 100)}%)
      </span>
    ) : (
      text
    );
  const unsure = (f?: { confidence: number }) =>
    f && f.confidence < SURE ? "border-warning" : "";

  const submit = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const at = text("weighedAt");
    const body: RegisterDocumentInput = {
      paperTicketNumber: text("paperTicketNumber") ?? "",
      weighedAt: at ? new Date(at).toISOString() : "",
      plate: text("plate") ?? "",
      trailerPlate: text("trailerPlate"),
      customerId: text("customerId") ?? "",
      productId,
      grossKg,
      tareKg,
      loadingAddress: text("loadingAddress"),
      unloadingAddress: text("unloadingAddress"),
      deliveryNoteNumber: text("deliveryNoteNumber"),
      ekaerNumber: text("ekaerNumber"),
      ekaerValueHuf:
        fileEkaer && !text("ekaerNumber")
          ? Number(text("ekaerValueHuf")) || null
          : null,
    };
    setBusy(true);
    try {
      const r = await api<Reply>(`documents/${doc.id}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      toast(
        r.warning ??
          `${r.registryNumber} rögzítve${
            r.ekaer === "filed"
              ? ", EKÁER-bejelentés elindult"
              : r.ekaer === "printed"
                ? ", a jegy EKÁER-számával"
                : ""
          }`,
      );
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const src = `/api/erp/documents/${doc.id}/file?raw=1`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Papír jegy ellenőrzése · {doc.fileName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Row className="mb-2">
              <Btn sm onClick={() => setRotate((r) => (r + 90) % 360)}>
                Forgatás
              </Btn>
              <Btn sm onClick={() => setZoom((z) => !z)}>
                {zoom ? "Kicsinyítés" : "Nagyítás"}
              </Btn>
            </Row>
            <div className="h-[60vh] overflow-auto rounded-lg border border-border bg-muted md:h-[70vh]">
              {doc.fileMime === "application/pdf" ? (
                <iframe src={src} title="Papír jegy" className="size-full" />
              ) : (
                // A private, signed file from our own origin; next/image would only add a proxy hop.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={`Papír jegy: ${doc.fileName}`}
                  style={{ transform: `rotate(${rotate}deg)` }}
                  className={
                    zoom
                      ? "max-w-none origin-center transition-transform"
                      : "w-full origin-center transition-transform"
                  }
                />
              )}
            </div>
          </div>
          <form
            id="paper-review"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget);
            }}
          >
            {error ? <Alert lvl="bad">{error}</Alert> : null}
            {!x ? (
              <Alert lvl="warn">
                Az AI nem tudta kiolvasni a képet; töltse ki kézzel.
              </Alert>
            ) : null}
            <Grid cols={2} className="gap-3">
              <Field label={label("Mérlegjegy száma", x?.ticketNumber)}>
                <Inp
                  name="paperTicketNumber"
                  required
                  defaultValue={x?.ticketNumber.value ?? ""}
                  className={unsure(x?.ticketNumber)}
                />
              </Field>
              <Field label={label("Mérés ideje", x?.weighedAt)}>
                <Inp
                  name="weighedAt"
                  type="datetime-local"
                  required
                  defaultValue={localInput(x?.weighedAt.value ?? null)}
                  className={unsure(x?.weighedAt)}
                />
              </Field>
              <Field label={label("Rendszám", x?.plate)}>
                <Inp
                  name="plate"
                  required
                  defaultValue={x?.plate.value ?? ""}
                  className={unsure(x?.plate)}
                />
              </Field>
              <Field label={label("Pótkocsi", x?.trailerPlate)}>
                <Inp
                  name="trailerPlate"
                  defaultValue={x?.trailerPlate.value ?? ""}
                  className={unsure(x?.trailerPlate)}
                />
              </Field>
              <Field
                label={label(
                  `Vevő (a jegyen: ${x?.customer.value ?? "—"})`,
                  x?.customer,
                )}
              >
                <Sel
                  name="customerId"
                  required
                  key={customers ? "loaded" : "loading"}
                  defaultValue={match(
                    customers ?? [],
                    x?.customer.value ?? null,
                  )}
                >
                  <option value="">
                    {customers === null ? "Betöltés…" : "Válasszon…"}
                  </option>
                  {(customers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field
                label={label(
                  `Termék (a jegyen: ${x?.product.value ?? "—"})`,
                  x?.product,
                )}
              >
                <Sel
                  name="productId"
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.currentTarget.value)}
                >
                  <option value="">
                    {products === null ? "Betöltés…" : "Válasszon…"}
                  </option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label={label("Bruttó (kg)", x?.grossKg)}>
                <Inp
                  type="number"
                  min={1}
                  required
                  value={grossKg || ""}
                  onChange={(e) => setGrossKg(Number(e.currentTarget.value))}
                  className={unsure(x?.grossKg)}
                />
              </Field>
              <Field label={label("Tára (kg)", x?.tareKg)}>
                <Inp
                  type="number"
                  min={1}
                  required
                  value={tareKg || ""}
                  onChange={(e) => setTareKg(Number(e.currentTarget.value))}
                  className={unsure(x?.tareKg)}
                />
              </Field>
              <Field label="Nettó (kg)">
                <Inp value={netKg > 0 ? netKg : "—"} readOnly />
              </Field>
              <Field
                label={label("Szállítólevél száma", x?.deliveryNoteNumber)}
              >
                <Inp
                  name="deliveryNoteNumber"
                  defaultValue={x?.deliveryNoteNumber.value ?? ""}
                  className={unsure(x?.deliveryNoteNumber)}
                />
              </Field>
              <Field
                label={label("Felrakodási cím", x?.loadingAddress)}
                className="col-span-2"
              >
                <Inp
                  name="loadingAddress"
                  defaultValue={x?.loadingAddress.value ?? ""}
                  placeholder="8000 Székesfehérvár, 020195/3 hrsz."
                  className={unsure(x?.loadingAddress)}
                />
              </Field>
              <Field
                label={label("Lerakodási cím", x?.unloadingAddress)}
                className="col-span-2"
              >
                <Inp
                  name="unloadingAddress"
                  defaultValue={x?.unloadingAddress.value ?? ""}
                  placeholder="Üresen a vevő címe"
                  className={unsure(x?.unloadingAddress)}
                />
              </Field>
              <Field label={label("EKÁER-szám a jegyen", x?.ekaerNumber)}>
                <Inp
                  name="ekaerNumber"
                  defaultValue={x?.ekaerNumber.value ?? ""}
                  onChange={(e) => setFileEkaer(!e.currentTarget.value.trim())}
                  className={unsure(x?.ekaerNumber)}
                />
              </Field>
              <Field label="EKÁER-érték (Ft)">
                <Inp
                  name="ekaerValueHuf"
                  type="number"
                  min={1}
                  key={`${productId}-${netKg}`}
                  defaultValue={suggestedHuf}
                  disabled={!fileEkaer}
                />
              </Field>
            </Grid>
            <label className="mt-3 flex items-center gap-2 text-control">
              <input
                type="checkbox"
                className="size-4"
                checked={fileEkaer}
                onChange={(e) => setFileEkaer(e.currentTarget.checked)}
              />
              EKÁER bejelentése mentéskor (csak ha a jegyen nincs EKÁER-szám)
            </label>
            <Small className="mt-2">
              Mentéskor papír mérlegelés (P-szám) és nyilvántartott szállítás
              lesz belőle. A sárga mezőket vesse össze a fotóval.
            </Small>
          </form>
        </div>
        <DialogFooter>
          <Btn onClick={onClose}>Mégse</Btn>
          <Btn
            kind="pri"
            type="submit"
            form="paper-review"
            disabled={busy || !customers || !products}
          >
            {busy ? "Mentés…" : "Mentés"}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
