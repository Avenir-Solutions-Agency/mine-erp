"use client";

import { ds, fmt, iso } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import {
  AiBox,
  Btn,
  Field,
  formChecked,
  formValue,
  Grid,
  Head,
  Inp,
  Mono,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";
import { hu } from "@/i18n/hu";
import { Phone, PhotoBtn } from "./operapp-parts";
import { Placeholder } from "./placeholder";

// V.operapp: shift close on the operator's phone.
export function OperAppScreen() {
  const { S, q, actions, view, consts, TODAY } = useDemo();
  const OPA = view.OPA;
  const ops = S.employees.filter((e) => /Rakodógép|Dózer/.test(e.role));
  const m = S.machines.find((x) => x.id === OPA.machine);
  if (!m) return <Placeholder route="operapp" message={hu.empty} />;
  const prodM = m.id === "OSZT-01" || m.id === "TOR-01";
  const auto = m.src === "szalagmérleg";
  const h0 = q.lastHours(m.id);
  const today = S.mlog.filter(
    (x) => iso(x.date) === iso(TODAY) && x.machine === m.id,
  );

  return (
    <>
      <Head
        title="Gépkezelő app"
        sub="Műszak végén a gépkezelő a telefonján 30–60 másodperc alatt zárja a műszakot: gép QR-kódja, óraállás, állásidő és oka, hiba fotóval. Ahol szalagmérleg, kanálmérleg vagy telematika van, az adat magától érkezik, a kezelő csak jóváhagyja."
        right={
          <Field label="Kezelő">
            <Sel
              defaultValue={OPA.op}
              onCommit={(el) => actions.setOperator(el.value)}
            >
              {ops.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Sel>
          </Field>
        }
      />
      <Phone>
        <Spread>
          <b>Műszakzárás</b>
          <span className="text-xs text-muted-foreground">{ds(TODAY)}</span>
        </Spread>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            actions.closeShift({
              machine: formValue(f, "opa-m"),
              hours: formValue(f, "opa-h"),
              idle: formValue(f, "opa-idle"),
              reason: formValue(f, "opa-reason"),
              fault: formChecked(f, "opa-fault"),
              faultText: formValue(f, "opa-ftext"),
              feed: f.elements.namedItem("opa-feed")
                ? formValue(f, "opa-feed")
                : undefined,
            });
          }}
        >
          <Stack className="mt-2.5">
            <Field label="Gép (QR-kód vagy választás)">
              <Sel
                name="opa-m"
                defaultValue={m.id}
                onCommit={(el) => actions.setOperatorMachine(el.value)}
              >
                {S.machines
                  .filter((x) => x.stage !== "fuvar")
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </Sel>
            </Field>
            <Small>
              Adatforrás: <b>{m.src}</b> · előző óraállás:{" "}
              <Mono>{fmt(h0, 1)}</Mono> · szervizig {fmt(m.next)} üzemóra
            </Small>
            <Grid cols={2}>
              <Field label="Óraállás most">
                <Inp
                  name="opa-h"
                  type="number"
                  step="0.1"
                  defaultValue={(h0 + 9.4).toFixed(1)}
                />
              </Field>
              <Field label="Állásidő (óra)">
                <Inp
                  name="opa-idle"
                  type="number"
                  step="0.1"
                  defaultValue="0.6"
                />
              </Field>
            </Grid>
            <Field label="Állás oka">
              <Sel name="opa-reason">
                {consts.IDLE.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Sel>
            </Field>
            {prodM ? (
              auto ? (
                <AiBox who="Szalagmérleg (automatikus)">
                  <Small>
                    0/4: 420 t · 4/11: 180 t · 11/22: 260 t · 22/63: 510 t — a
                    kezelő csak jóváhagyja
                  </Small>
                </AiBox>
              ) : (
                <Field label="Feladott anyag (t, kanálmérleg)">
                  <Inp name="opa-feed" type="number" defaultValue="1520" />
                </Field>
              )
            ) : null}
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="opa-fault" /> Hiba volt a műszakban
            </label>
            <Field label="Hiba leírása">
              <Inp
                name="opa-ftext"
                placeholder="pl. hidraulika szivárog a bal emelőhengernél"
              />
            </Field>
            <PhotoBtn onPhoto={(img) => actions.setOperatorPhoto(img)}>
              Fotó a hibáról
            </PhotoBtn>
            <Btn kind="pri" type="submit">
              Műszak lezárása
            </Btn>
          </Stack>
        </form>
        {today.length ? (
          <>
            <h3 className="mt-3">Ma rögzítve</h3>
            {today.map((x) => (
              <Small key={x.id}>
                {x.id} · {x.operator} · {fmt(x.run, 1)} h üzem, {fmt(x.idle, 1)}{" "}
                h állás
                {x.fault ? " · hiba: " + x.fault : ""}
              </Small>
            ))}
          </>
        ) : null}
      </Phone>
    </>
  );
}
