"use client";

import type { Transport } from "@mine-erp/domain/demo";
import { ds, fmt, fmtH, iso, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
import { SigPad, sigData } from "@/prototype/sig-pad";
import { Kpi } from "@/components/ui/kpi";
import {
  Btn,
  Field,
  formValue,
  Grid,
  Head,
  Inp,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";
import { hu } from "@/i18n/hu";
import { PhotoBtn, SigImg } from "./driverapp-parts";
import { Placeholder } from "./placeholder";

// V.driverapp: the driver's phone/tablet view (PWA).
export function DriverAppScreen() {
  const { S, q, view, actions, TODAY } = useDemo();
  const d = q.DR(view.DRV.id);
  if (!d) return <Placeholder route="driverapp" message={hu.empty} />;
  const ts = S.transports
    .filter(
      (f) =>
        f.driverId === d.id &&
        iso(f.date) === iso(TODAY) &&
        f.status !== "Törölve" &&
        f.status !== "Javasolt",
    )
    .sort((a, b) => (a.start || 0) - (b.start || 0));
  const dd = q.driverDay(d.id, TODAY);
  return (
    <>
      <Head
        title="Sofőr app"
        sub="Ez a sofőr telefonján / tabletjén futó nézet (PWA). Átvételkor a vevő itt írja alá a szállítólevelet és — az utolsó fordulónál — a teljesítésigazolást, vagy a sofőr lefotózza a papíron aláírt iratot."
        right={
          <Field label="Sofőr">
            <Sel
              defaultValue={d.id}
              onCommit={(el) => actions.setDriverApp(el.value)}
            >
              {S.drivers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Sel>
          </Field>
        }
      />
      <div className="max-w-130 rounded-2xl border border-border bg-card p-4">
        <Spread>
          <b>{d.name}</b>
          <Small>{ds(TODAY)}</Small>
        </Spread>
        <Grid cols={2} className="my-2.5">
          <Kpi label="Mai vezetés" value={`${fmt(dd.drive, 1)} / 9 h`} />
          <Kpi label="Fordulók" value={ts.length} />
        </Grid>
        {ts.length ? (
          ts.map((f, i) => <Trip key={f.id} f={f} i={i} />)
        ) : (
          <Small className="my-3">
            Ma nincs elfogadott fuvar ennél a sofőrnél. (A diszpécser elfogadása
            után jelenik meg.)
          </Small>
        )}
      </div>
    </>
  );
}

function Trip({ f, i }: { f: Transport; i: number }) {
  const { S, q, actions } = useDemo();
  const o = S.orders.find((x) => x.id === f.order)!;
  const dn = S.docs.find((x) => x.id === f.dn);
  const last =
    o.lines.every((l) => (o.delivered[l.pid] || 0) >= l.qty * 0.98) &&
    S.tigs.find((t) => t.id === f.tig && t.status === "Aláírásra vár");
  return (
    <Panel className="mb-2.5">
      <form onSubmit={(e) => e.preventDefault()}>
        <Spread>
          <b>
            {i + 1}. {fmtH(f.start || 6)} · {f.truck}
          </b>
          <StatusPill status={f.pod ? "Átvéve" : f.status} />
        </Spread>
        <div>
          {f.clientName} — {o.zip} {o.city || ""} {o.addr || ""}
        </div>
        <Small>
          {q.P(f.pid).name} · terv {tn(f.planned)} · {f.km} km · EKÁER{" "}
          {f.ekaer.number || "nem köteles"}
        </Small>
        {f.status === "Tervezett" ? (
          <Row className="mt-2">
            <Field label="Mérlegjegy nettó (t)">
              <Inp
                name={`w-${f.id}`}
                type="number"
                step="0.01"
                defaultValue={(f.planned - 0.3).toFixed(2)}
              />
            </Field>
            <Btn
              kind="pri"
              className="self-end"
              onClick={(e) =>
                actions.closeClick(
                  f.id,
                  formValue(e.currentTarget.form, `w-${f.id}`),
                  0,
                )
              }
            >
              Felrakva, indulok
            </Btn>
          </Row>
        ) : null}
        {f.status === "Lezárva" && !f.pod ? (
          <Stack className="mt-2">
            <Small>
              Szállítólevél:{" "}
              <span className="font-mono">{(dn && dn.number) || "—"}</span> ·{" "}
              {tn(f.net)}
            </Small>
            <Field label="Átvevő neve">
              <Inp
                name={`pn-${f.id}`}
                defaultValue={
                  f.clientId === "c1"
                    ? "Kovács Ferenc építésvezető"
                    : f.clientId === "c2"
                      ? "Tóth Gábor"
                      : "Átvevő"
                }
              />
            </Field>
            <Field label="Várakozás a lerakón (perc)">
              <Inp
                name={`pw-${f.id}`}
                type="number"
                defaultValue={f.clientId === "c1" ? 55 : 20}
              />
            </Field>
            <SigPad
              id={`ps-${f.id}`}
              label="Átvevő aláírása a szállítólevélre"
            />
            {last ? (
              <SigPad
                id={`pt-${f.id}`}
                label={`Teljesítésigazolás aláírása (${last.id}, a megrendelés utolsó fordulója)`}
              />
            ) : null}
            <Row>
              <Btn
                kind="pri"
                onClick={(e) =>
                  actions.recordPod(
                    f.id,
                    formValue(e.currentTarget.form, `pn-${f.id}`),
                    formValue(e.currentTarget.form, `pw-${f.id}`),
                    sigData(`ps-${f.id}`),
                    sigData(`pt-${f.id}`),
                  )
                }
              >
                Átvétel rögzítése
              </Btn>
              <PhotoBtn
                onPhoto={(img, name) =>
                  actions.photoUpload("pod", f.id, img, name)
                }
              >
                Aláírt papír fotója
              </PhotoBtn>
            </Row>
          </Stack>
        ) : null}
        {f.pod ? (
          <>
            <Small className="mt-1.5">
              Átvette: {f.pod.name} ·{" "}
              {new Date(f.pod.t).toLocaleTimeString("hu-HU", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {f.pod.how}
            </Small>
            {f.pod.img ? <SigImg src={f.pod.img} alt="Aláírás" /> : null}
          </>
        ) : null}
      </form>
    </Panel>
  );
}
