"use client";

import { ds, fmt, ft } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
import { SigPad, sigData } from "@/prototype/sig-pad";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AiBox,
  Alert,
  Btn,
  Field,
  formValue,
  Grid,
  Head,
  Inp,
  Panel,
  Row,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";
import { PhotoBtn, SigImg } from "./driverapp-parts";

const SHORT: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

// V.tig: completion certificates (teljesítésigazolás).
export function TigScreen() {
  const { S, actions } = useDemo();
  const waiting = S.orders
    .map((o) => ({
      o,
      n: S.transports.filter(
        (f) => f.order === o.id && f.status === "Lezárva" && !f.tig,
      ).length,
    }))
    .filter((x) => x.n);
  return (
    <>
      <Head
        title="Teljesítésigazolás"
        sub="Minden teljesített megrendelésből (vagy elszámolási időszakból) TIG készül. A vevő átvételkor a sofőr tabletjén, a vevői portálon elektronikusan, vagy aláírt papír fotójával fogadja el; elfogadás után automatikusan indul a számla."
      />
      <Grid cols={2}>
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TIG</TableHead>
                <TableHead>Vevő · megrendelés</TableHead>
                <TableHead>Időszak</TableHead>
                <TableHead numeric>Forduló</TableHead>
                <TableHead>Állapot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.tigs.length ? (
                S.tigs.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => actions.openTig(t.id)}
                  >
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell>
                      {t.clientName}
                      <Small>{t.order}</Small>
                    </TableCell>
                    <TableCell>
                      {ds(t.from)} – {ds(t.to).slice(6)}
                    </TableCell>
                    <TableCell numeric>{t.trips.length}</TableCell>
                    <TableCell>
                      <StatusPill status={t.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-xs text-muted-foreground"
                  >
                    Nincs TIG.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <h3 className="mt-3">TIG-re váró lezárt fordulók</h3>
          {waiting.length ? (
            waiting.map(({ o, n }) => (
              <Alert key={o.id} lvl="warn">
                {o.id} · {o.clientName}: {n} forduló{" "}
                <Btn sm kind="ai" onClick={() => actions.makeTig(o.id)}>
                  TIG készítése
                </Btn>
              </Alert>
            ))
          ) : (
            <Small className="my-3">Nincs.</Small>
          )}
        </Panel>
        <div>
          <TigDetail />
        </div>
      </Grid>
    </>
  );
}

function TigDetail() {
  const { S, q, ui, actions } = useDemo();
  const cur = S.tigs.find((t) => t.id === ui.sel.tig) || S.tigs[0];
  if (!cur) return null;
  const L = q.tigLines(cur);
  return (
    <Panel>
      <Spread>
        <h2>{cur.id}</h2>
        <StatusPill status={cur.status} />
      </Spread>
      <p className="my-3 text-control">
        Megrendelő: <b>{cur.clientName}</b> · megrendelés {cur.order} ·
        elszámolási időszak {ds(cur.from)} – {ds(cur.to)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nap</TableHead>
            <TableHead>Fuvar</TableHead>
            <TableHead>Szállítólevél</TableHead>
            <TableHead>Rendszám</TableHead>
            <TableHead>Termék</TableHead>
            <TableHead numeric>Nettó t</TableHead>
            <TableHead numeric>Nettó Ft</TableHead>
            <TableHead>Átvétel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {L.rows.map((r) => (
            <TableRow key={r.f.id}>
              <TableCell>{ds(r.f.date)}</TableCell>
              <TableCell className="font-mono text-xs">{r.f.id}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {(r.dn && r.dn.number) || "—"}
              </TableCell>
              <TableCell>{r.f.truck}</TableCell>
              <TableCell>{q.P(r.f.pid).name}</TableCell>
              <TableCell numeric>{fmt(r.f.net, 2)}</TableCell>
              <TableCell numeric>{ft(r.net)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.f.pod ? r.f.pod.name : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>Termék</TableCell>
            <TableCell numeric>{fmt(L.tons, 2)}</TableCell>
            <TableCell numeric>{ft(L.prod)}</TableCell>
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell colSpan={6}>Fuvardíj</TableCell>
            <TableCell numeric>{ft(L.fr)}</TableCell>
            <TableCell />
          </TableRow>
          {L.wait ? (
            <TableRow>
              <TableCell colSpan={6}>Állásidő</TableCell>
              <TableCell numeric>{ft(L.wait)}</TableCell>
              <TableCell />
            </TableRow>
          ) : null}
          <TableRow>
            <TableCell colSpan={6}>Nettó összesen</TableCell>
            <TableCell numeric>{ft(L.total)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
      {cur.sig ? (
        <>
          <Small>
            Elfogadta: {cur.signer} · {cur.signedAt?.toLocaleString("hu-HU")} ·{" "}
            {cur.ik || ""}
          </Small>
          <SigImg src={cur.sig} alt="Aláírás" />
        </>
      ) : null}
      {cur.status === "Aláírásra vár" ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <Stack className="mt-2.5">
            <Field label="Aláíró neve">
              <Inp
                name="ts-n"
                defaultValue={
                  cur.clientId === "c1"
                    ? "Kovács Ferenc építésvezető"
                    : "Vevő képviselője"
                }
              />
            </Field>
            <SigPad
              id="ts-sig"
              label="Aláírás (vevő, portálon vagy helyszínen)"
            />
            <Row>
              <Btn
                kind="pri"
                onClick={(e) =>
                  actions.signTig(
                    cur.id,
                    formValue(e.currentTarget.form, "ts-n"),
                    sigData("ts-sig"),
                  )
                }
              >
                Teljesítés elfogadása
              </Btn>
              <PhotoBtn
                onPhoto={(img, name) =>
                  actions.photoUpload("tig", cur.id, img, name)
                }
              >
                Aláírt TIG fotója
              </PhotoBtn>
              <Btn kind="bad" sm onClick={() => actions.objectTig(cur.id)}>
                Vevői kifogás rögzítése
              </Btn>
            </Row>
          </Stack>
        </form>
      ) : null}
      {cur.objection ? (
        <AiBox who="Teljesítésigazoló · kifogás kezelése" className="mt-2">
          <p>{cur.objection}</p>
        </AiBox>
      ) : null}
      <h3 className="mt-2.5">Előzmények</h3>
      {cur.history.map((h, i) => (
        <Small key={i}>
          {new Date(h[0]).toLocaleString("hu-HU", SHORT)} · {h[1]} — {h[2]}
        </Small>
      ))}
    </Panel>
  );
}
