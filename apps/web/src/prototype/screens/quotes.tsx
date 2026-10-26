"use client";

import type { Quote } from "@mine-erp/domain/demo";
import { ds, ft, pct, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { pillTone, StatusPill } from "@/prototype/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Alert,
  Btn,
  Flow,
  Grid,
  Head,
  Panel,
  Row,
  Small,
  Spread,
} from "@/prototype/ui";

// V.quotes; quoteDetail carries the customer document and follow-up patch.
export function QuotesScreen() {
  const { S, actions, ui } = useDemo();
  const cur = S.quotes.find((x) => x.id === ui.sel.q) || S.quotes[0];
  return (
    <>
      <Head
        title="Árajánlatok"
        sub="Az ár önköltségből, fuvartávolságból, kedvezményszintből és célárrésből áll össze. Ami a házirend alatt marad, ember hagyja jóvá."
      />
      <Grid cols={2}>
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sorszám</TableHead>
                <TableHead>Ügyfél</TableHead>
                <TableHead numeric>Nettó</TableHead>
                <TableHead numeric>Árrés</TableHead>
                <TableHead>Állapot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.quotes.map((q) => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => actions.openQuote(q.id)}
                >
                  <TableCell className="font-mono text-xs">{q.id}</TableCell>
                  <TableCell>
                    {q.clientName}
                    <Small>
                      {q.zip} {q.city || ""}
                    </Small>
                  </TableCell>
                  <TableCell numeric>{ft(q.pr.net)}</TableCell>
                  <TableCell numeric>
                    <Pill
                      tone={pillTone(
                        q.pr.margin < S.policy.minMargin
                          ? "bad"
                          : q.pr.margin < S.policy.targetMargin
                            ? "warn"
                            : "ok",
                      )}
                    >
                      {pct(q.pr.margin)}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={q.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <div>{cur ? <QuoteDetail q={cur} /> : null}</div>
      </Grid>
    </>
  );
}

function QuoteDetail({ q }: { q: Quote }) {
  const demo = useDemo();
  const { S, actions } = demo;
  const pr = q.pr;
  const c = (q.clientId && demo.q.C(q.clientId)) || undefined;
  const fu = S.followups.filter((f) => f.q === q.id);
  return (
    <Panel>
      <Spread>
        <h2>
          {q.id} · {q.clientName}
        </h2>
        <StatusPill status={q.status} />
      </Spread>
      <Flow
        className="mt-2.5"
        steps={[
          ["Ajánlatkérés", !!q.inq],
          ["Ajánlat", true],
          ["Megrendelés", !!q.orderId],
          ["Fuvar", false],
          ["Számla", false],
        ]}
      />
      <Small className="my-3">
        Szállítás: {q.zip} {q.city || ""} {q.addr || ""} · {pr.km} km ·{" "}
        {pr.trips} forduló · érvényes: {ds(q.valid)}
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tétel</TableHead>
            <TableHead numeric>Menny.</TableHead>
            <TableHead numeric>Önköltség/t</TableHead>
            <TableHead numeric>Egységár/t</TableHead>
            <TableHead numeric>Nettó</TableHead>
            <TableHead numeric>Árrés</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pr.lines.map((l, k) => (
            <TableRow key={k}>
              <TableCell>{l.name}</TableCell>
              <TableCell numeric>{tn(l.qty)}</TableCell>
              <TableCell numeric>{ft(l.unitCost)}</TableCell>
              <TableCell numeric>{ft(l.unitNet)}</TableCell>
              <TableCell numeric>{ft(l.net)}</TableCell>
              <TableCell numeric>{pct(l.margin)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              Fuvardíj{" "}
              <span className="text-xs text-muted-foreground">
                ({pr.trips} × {pr.km * 2} km × {ft(demo.q.costModel().ftPerKm)}{" "}
                + útdíj, +{pct(S.policy.freightMarkup)})
              </span>
            </TableCell>
            <TableCell numeric>{tn(pr.totalT)}</TableCell>
            <TableCell numeric>{ft(pr.freightCost / pr.totalT)}</TableCell>
            <TableCell numeric>{ft(pr.freightPerT)}</TableCell>
            <TableCell numeric>{ft(pr.freightNet)}</TableCell>
            <TableCell numeric />
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>
              Nettó összesen · bruttó {ft(pr.gross)}
            </TableCell>
            <TableCell numeric>{ft(pr.net)}</TableCell>
            <TableCell numeric>{pct(pr.margin)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <h3 className="mt-3">Ellenőrzések</h3>
      {pr.flags.length ? (
        pr.flags.map((f, k) => (
          <Alert key={k} lvl={f.lvl}>
            {f.t}
          </Alert>
        ))
      ) : (
        <Alert lvl="ok">Árrés, készlet és hitelkeret rendben.</Alert>
      )}
      <Row className="mt-2.5">
        {q.status === "Jóváhagyásra vár" ? (
          <>
            <Btn kind="pri" onClick={() => actions.approveQuote(q.id)}>
              Jóváhagyom és kiküldöm
            </Btn>
            <Btn kind="ai" onClick={() => actions.repriceQuote(q.id)}>
              Átárazás célárrésre
            </Btn>
          </>
        ) : null}
        {q.status === "Kiküldve" && !q.orderId ? (
          <Btn kind="pri" onClick={() => actions.orderFromQuote(q.id)}>
            Ügyfél elfogadta → megrendelés
          </Btn>
        ) : null}
        {q.orderId ? (
          <Btn onClick={() => demo.go("orders")}>Megrendelés {q.orderId}</Btn>
        ) : null}
      </Row>
      <details className="mt-3">
        <summary className="cursor-pointer text-control">
          <b>Az ügyfélnek kiküldött ajánlat (e-mail + PDF tartalma)</b>
        </summary>
        <Panel className="mt-2 bg-muted">
          <Spread>
            <div>
              <b>Mészkő-Polgár Kft.</b>
              <Small>8154 Polgárdi, Bánya út 1. · adószám 12312312-2-07</Small>
            </div>
            <div className="font-mono text-xs">{q.id}</div>
          </Spread>
          <p className="my-3">
            Címzett: <b>{q.clientName}</b>
            {c?.tax ? ` · ${c.tax}` : ""}
            <br />
            Szállítási cím: {q.zip} {q.city || ""} {q.addr || ""}
            <br />
            Kért szállítás: {q.date ? ds(q.date) : "egyeztetés szerint"} ·
            Ajánlat érvényes: {ds(q.valid)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Megnevezés</TableHead>
                <TableHead numeric>Mennyiség</TableHead>
                <TableHead numeric>Nettó egységár</TableHead>
                <TableHead numeric>Nettó</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.lines.map((l, k) => (
                <TableRow key={k}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell numeric>{tn(l.qty)}</TableCell>
                  <TableCell numeric>{ft(l.unitNet)}/t</TableCell>
                  <TableCell numeric>{ft(l.net)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Fuvardíj, {pr.trips} forduló</TableCell>
                <TableCell numeric>{tn(pr.totalT)}</TableCell>
                <TableCell numeric>{ft(pr.freightPerT)}/t</TableCell>
                <TableCell numeric>{ft(pr.freightNet)}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Nettó / ÁFA 27% / Bruttó</TableCell>
                <TableCell numeric>
                  {ft(pr.net)} / {ft(pr.net * 0.27)} / {ft(pr.gross)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <Small className="my-3">
            Fizetés:{" "}
            {c?.end
              ? "előre utalás vagy készpénz rakodáskor"
              : `átutalás, ${c?.payDays} nap`}
            . A mennyiség a hídmérleg szerinti nettó tömeg alapján kerül
            számlázásra. Termékek CE-jelöléssel, teljesítménynyilatkozattal (EN
            13242 / EN 12620).
          </Small>
          <Row>
            <span
              aria-disabled="true"
              className={cn(
                buttonVariants({ variant: "default" }),
                "text-control",
              )}
            >
              Elfogadom az ajánlatot
            </span>
            <Small>
              ← az ügyfél e-mailjében egyedi, aláírt link; elfogadás után a
              megrendelés automatikusan létrejön
            </Small>
          </Row>
        </Panel>
      </details>
      {fu.length ? (
        <>
          <h3 className="mt-3">Utánkövetés</h3>
          {fu.map((f, k) => (
            <Alert key={k} lvl="ai">
              <b>{f.kind}</b> ({f.age}. nap, {f.status})<Small>{f.txt}</Small>
            </Alert>
          ))}
        </>
      ) : null}
    </Panel>
  );
}
