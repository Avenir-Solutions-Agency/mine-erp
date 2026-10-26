"use client";

import type { ChangeEvent } from "react";
import type { Extraction, Inquiry } from "@mine-erp/domain/demo";
import { ds, pct, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { readText } from "@/prototype/files";
import { StatusPill } from "@/prototype/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AiBox,
  Alert,
  Area,
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

const EMAIL_BODY = `Jó napot!
1134 Budapest, Váci út 45. címre kérnénk:
450 t Z 0/63
80 t terméskő 63/180
2026.10.15-ig.
Projekt: M0 Gyál lehajtó, 2. ütem
Köszönöm, V-Híd Építő Zrt.`;

// V.inbox with the round patches (channel select, file intake incl. PDF/Excel, project, direct order).
export function InboxScreen() {
  const demo = useDemo();
  const { S, actions, ui } = demo;
  const list = S.inquiries;
  const cur = list.find((i) => i.id === ui.sel.inq) || list[0];

  // The demo's two 'change' listeners on #em-file: PDF/Excel first (capture), plain text otherwise.
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    const from = formValue(e.currentTarget.form, "em-from");
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!/\.(pdf|xlsx|xls)$/.test(name)) {
      const txt = await readText(f);
      actions.fileInquiry(f.name, txt.slice(0, 8000), from);
      return;
    }
    let txt = "";
    try {
      if (!name.endsWith(".pdf")) {
        // xlsx dependency pending (T-026)
        throw new Error("xlsx");
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await f.arrayBuffer()),
      }).promise;
      for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
        const c = await (await pdf.getPage(p)).getTextContent();
        txt +=
          c.items
            .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
            .join("") + "\n";
      }
    } catch {
      demo.toast("A fájlt nem sikerült beolvasni ebben a nézetben.");
      return;
    }
    actions.fileInquiry(f.name, txt, from, "E-mail csatolmány (PDF)");
  }

  return (
    <>
      <Head
        title="Ajánlatkérések"
        sub="Web és e-mail egy helyen. Az AI kinyeri a tételeket, árat számol, és a házirend alapján kiküldi vagy jóváhagyásra teszi."
      />
      <Grid cols={2}>
        <Stack>
          <Panel>
            <h2>Beérkezett</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Csatorna</TableHead>
                  <TableHead>Feladó</TableHead>
                  <TableHead>Tárgy</TableHead>
                  <TableHead>Állapot</TableHead>
                  <TableHead numeric>Bizonyosság</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((i) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer"
                    onClick={() => actions.selectInquiry(i.id)}
                  >
                    <TableCell>{i.channel}</TableCell>
                    <TableCell>
                      {i.name || i.from}
                      <Small>{i.from}</Small>
                    </TableCell>
                    <TableCell>{i.subject}</TableCell>
                    <TableCell>
                      <StatusPill status={i.status} />
                    </TableCell>
                    <TableCell numeric>
                      {i.conf != null ? pct(i.conf) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <h2>Új e-mail szimulálása</h2>
            <Small className="my-3">
              Illesszen be egy tetszőleges ajánlatkérő levelet. Élesben ez a
              vevo@ postafiókra érkező levél (Microsoft 365 / Gmail webhook).
            </Small>
            <form onSubmit={(e) => e.preventDefault()}>
              <Grid cols={2}>
                <Field label="Csatorna">
                  <Sel name="em-ch">
                    <option>E-mail</option>
                    <option>Telefonos jegyzet</option>
                    <option>E-mail csatolmány</option>
                  </Sel>
                </Field>
                <Field label="Feladó e-mail">
                  <Inp name="em-from" defaultValue="beszerzes@vhid.hu" />
                </Field>
                <Field label="Tárgy">
                  <Inp
                    name="em-subj"
                    defaultValue="Árajánlat kérés — M0 lehajtó"
                  />
                </Field>
              </Grid>
              <Field label="Levél szövege" className="mt-2">
                <Area name="em-body" rows={6} defaultValue={EMAIL_BODY} />
              </Field>
              <Row className="mt-2">
                <Btn
                  kind="pri"
                  onClick={(e) => {
                    const form = e.currentTarget.form;
                    // The channel select is not read by the demo's handler.
                    actions.emailInquiry({
                      from: formValue(form, "em-from"),
                      subject: formValue(form, "em-subj"),
                      body: formValue(form, "em-body"),
                    });
                  }}
                >
                  Beérkeztetés és AI feldolgozás
                </Btn>
                <label
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "cursor-pointer text-control",
                  )}
                >
                  Fájl beolvasása (PDF, Excel, .eml, .txt)
                  <input
                    type="file"
                    accept=".txt,.eml,.csv,.pdf,.xlsx,.xls,text/plain,application/pdf"
                    hidden
                    onChange={(e) => void onFile(e)}
                  />
                </label>
              </Row>
            </form>
          </Panel>
          <Panel>
            <h2>Webes ajánlatkérő (a mpkft.hu űrlapja)</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                actions.submitWebInquiry({
                  name: formValue(form, "wf-name"),
                  mail: formValue(form, "wf-mail"),
                  prod: formValue(form, "wf-prod"),
                  qty: formValue(form, "wf-qty"),
                  zip: formValue(form, "wf-zip"),
                  city: formValue(form, "wf-city"),
                  date: formValue(form, "wf-date"),
                });
              }}
            >
              <Grid cols={2}>
                <Field label="Név / cégnév">
                  <Inp
                    name="wf-name"
                    required
                    defaultValue="Pintér Építő Bt."
                  />
                </Field>
                <Field label="E-mail">
                  <Inp
                    name="wf-mail"
                    type="email"
                    required
                    defaultValue="iroda@pinterepito.hu"
                  />
                </Field>
                <Field label="Termék">
                  <Sel name="wf-prod">
                    {S.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Sel>
                </Field>
                <Field label="Mennyiség (t)">
                  <Inp name="wf-qty" type="number" min={1} defaultValue="60" />
                </Field>
                <Field label="Irányítószám">
                  <Inp name="wf-zip" defaultValue="8200" pattern="\d{4}" />
                </Field>
                <Field label="Település">
                  <Inp name="wf-city" defaultValue="Veszprém" />
                </Field>
                <Field label="Kért nap">
                  <Inp name="wf-date" type="date" defaultValue="2026-10-09" />
                </Field>
                <Row className="self-end">
                  <Btn kind="pri" type="submit">
                    Ajánlatot kérek
                  </Btn>
                </Row>
              </Grid>
            </form>
            <Small className="my-3">
              Az ügyfél 1–2 percen belül megkapja az árat, ha a házirend engedi
              az automatikus küldést.
            </Small>
          </Panel>
        </Stack>
        <Stack>{cur ? <InquiryDetail i={cur} /> : null}</Stack>
      </Grid>
    </>
  );
}

function Missing({ children }: { children: string }) {
  return <Pill tone="warning">{children}</Pill>;
}

// inqDetail with the Claude row, project row, direct order button and banner.
function InquiryDetail({ i }: { i: Inquiry }) {
  const { S, q, actions, ui } = useDemo();
  const ex: Partial<Extraction> & Pick<Extraction, "lines"> = i.ex || {
    lines: [],
  };
  const quote = S.quotes.find((x) => x.id === i.quoteId);
  const sample = ui.sample;
  const canDirect = ex.lines.length > 0 && ex.clientId && !i.directOrder;
  return (
    <>
      <Panel>
        <Spread>
          <h2>{i.subject}</h2>
          <StatusPill status={i.status} />
        </Spread>
        <Small>
          {i.channel} · {i.from} · {ds(i.received)}
        </Small>
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-muted p-2.5 font-mono text-label whitespace-pre-wrap">
          {i.raw}
        </pre>
      </Panel>
      {i.directOrder ? (
        <Alert lvl="ok">
          Közvetlen megrendelés: <b className="font-mono">{i.directOrder}</b>
        </Alert>
      ) : null}
      <AiBox who="Ajánlatkérés-feldolgozó · kinyert adatok">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Ügyfél</TableCell>
              <TableCell>
                {ex.clientId ? (
                  <>
                    {q.C(ex.clientId)?.name}{" "}
                    <Pill tone="success">törzsben</Pill>
                  </>
                ) : (
                  <>
                    {ex.company || i.name} <Missing>új ügyfél</Missing>
                  </>
                )}
              </TableCell>
            </TableRow>
            {ex.project ? (
              <TableRow>
                <TableCell>Projekt</TableCell>
                <TableCell>
                  <b>{ex.project}</b>
                </TableCell>
              </TableRow>
            ) : null}
            <TableRow>
              <TableCell>Tételek</TableCell>
              <TableCell>
                {ex.lines.length ? (
                  ex.lines.map((l, k) => (
                    <span key={k}>
                      {k > 0 ? <br /> : null}
                      {q.P(l.pid).name} — <b>{tn(l.qty)}</b>
                      {l.note ? (
                        <>
                          {" "}
                          <span className="text-xs text-muted-foreground">
                            ({l.note})
                          </span>
                        </>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <Missing>nem található</Missing>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Szállítási cím</TableCell>
              <TableCell>
                {ex.zip ? (
                  `${ex.zip} ${ex.city} ${ex.addr} · ${q.distKm(ex.zip)} km`
                ) : (
                  <Missing>hiányzik</Missing>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Határidő</TableCell>
              <TableCell>
                {ex.date ? ds(ex.date) : <Missing>hiányzik</Missing>}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Bizonyosság</TableCell>
              <TableCell>
                {pct(i.conf || 0)}
                {ex.missing?.length
                  ? ` · hiányzik: ${ex.missing.join(", ")}`
                  : ""}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Row className="mt-2">
          {canDirect ? (
            <Btn kind="pri" sm onClick={() => actions.directOrder(i.id)}>
              Közvetlen megrendelés (ajánlat nélkül)
            </Btn>
          ) : null}
          {sample ? (
            <Btn
              kind="ai"
              sm
              disabled={i.claudeBusy}
              onClick={() => void actions.claudeParse(i.id)}
            >
              {i.claudeBusy
                ? "Claude dolgozik…"
                : "Újraértelmezés élő Claude-dal"}
            </Btn>
          ) : (
            <span className="text-xs text-muted-foreground">
              Élő Claude-értelmezés a claude.ai-ban megnyitott oldalon érhető
              el.
            </span>
          )}
        </Row>
        {i.reply ? (
          <>
            <h3 className="mt-2">Visszakérdező válasz-piszkozat</h3>
            <p>{i.reply}</p>
          </>
        ) : null}
        {quote ? (
          <Row className="mt-2">
            <Btn sm onClick={() => actions.openQuote(quote.id)}>
              Ajánlat {quote.id} megnyitása
            </Btn>
          </Row>
        ) : null}
      </AiBox>
    </>
  );
}
