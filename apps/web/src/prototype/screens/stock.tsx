"use client";

import { ds, fmt, pct, tn } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  Btn,
  Field,
  formValue,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  Spread,
} from "@/prototype/ui";

// V.stock with the round-3 shift log and lab panels before the sites grid and the round-2 transfer, survey and cover panels after.
export function StockScreen() {
  const { S, q, actions, consts } = useDemo();
  const { stockOf, reservedOf, P, D } = q;
  const cm = q.costModel();
  const rows = S.products.map((p) => ({
    p,
    total: stockOf(p.id),
    res: reservedOf(p.id),
  }));
  const cover = S.products.map((p) => {
    const daily = cm.soldT[p.id] / 30,
      free = stockOf(p.id) - reservedOf(p.id);
    return { p, daily, free, days: daily ? free / daily : 999 };
  });
  const productOptions = S.products.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ));
  const depotOptions = S.depots.map((d) => (
    <option key={d.id} value={d.id}>
      {d.name}
    </option>
  ));

  return (
    <>
      <Head
        title="Termékkészlet"
        sub="Bánya → depó → frakció bontás egyetlen mozgásnaplóból. A kezdőlap, a riport és a depónézet ugyanazt a számot mutatja."
      />
      <Grid cols={2} className="mb-3.5">
        <Panel>
          <h2>Műszaknapló — termelés könyvelése</h2>
          <Small className="my-3">
            A törőkezelő a műszak végén a tabletről rögzíti a feladott tonnát (a
            homlokrakodó kanálmérlegéből) és az üzemórát; a frakciók a receptúra
            kihozatala szerint kerülnek a depókba. A heti depófelmérés
            korrigálja a kihozatali arányt.
          </Small>
          <form
            className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitShift(
                formValue(f, "sh-r"),
                +formValue(f, "sh-t"),
                +formValue(f, "sh-h"),
              );
            }}
          >
            <Field label="Receptúra">
              <Sel name="sh-r">
                {Object.keys(consts.RECIPE).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Sel>
            </Field>
            <Field label="Feladott anyag (t)">
              <Inp name="sh-t" type="number" defaultValue="1800" />
            </Field>
            <Field label="Üzemóra">
              <Inp name="sh-h" type="number" step="0.5" defaultValue="8" />
            </Field>
            <Row className="self-end">
              <Btn kind="pri" type="submit">
                Műszak könyvelése
              </Btn>
            </Row>
          </form>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Műszak</TableHead>
                <TableHead>Receptúra</TableHead>
                <TableHead numeric>Feladás</TableHead>
                <TableHead numeric>t/óra</TableHead>
                <TableHead>Kihozatal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.shifts.slice(0, 6).map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-mono text-xs">
                    {x.id}
                    <Small>
                      {ds(x.date)} · {x.who}
                    </Small>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {x.recipe}
                  </TableCell>
                  <TableCell numeric>{tn(x.inT)}</TableCell>
                  <TableCell numeric>
                    <Pill
                      tone={
                        x.tph < 180 && x.recipe.startsWith("TOR-01")
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {fmt(x.tph)}
                    </Pill>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {x.out
                      .map((o) => `${P(o.pid).name} ${tn(o.t)}`)
                      .join(" · ")}{" "}
                    · veszteség {tn(x.loss)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Panel>
          <h2>Minőség és megfelelőség</h2>
          <Small className="my-3">
            Heti szemeloszlás-vizsgálat (EN 933-1) frakciónként. Nem megfelelő
            eredménynél a termék automatikusan zárolódik: ajánlat és fuvar nem
            adható ki belőle.
          </Small>
          <form
            className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitLab(
                formValue(f, "lb-p"),
                formValue(f, "lb-r") === "1",
                formValue(f, "lb-n"),
              );
            }}
          >
            <Field label="Termék">
              <Sel name="lb-p">
                {S.products
                  .filter((p) => p.src === "own")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Sel>
            </Field>
            <Field label="Eredmény">
              <Sel name="lb-r">
                <option value="1">Megfelel</option>
                <option value="0">Nem felel meg</option>
              </Sel>
            </Field>
            <Field label="Megjegyzés" className="col-span-full">
              <Inp
                name="lb-n"
                defaultValue="0,063 mm alatti rész 9% (határérték 7%)"
              />
            </Field>
            <Row>
              <Btn kind="pri" type="submit">
                Vizsgálat rögzítése
              </Btn>
            </Row>
          </form>
          <Table className="mt-2">
            <TableBody>
              {S.lab.slice(0, 6).map((x) => (
                <TableRow key={x.id}>
                  <TableCell>
                    <Mono>{x.id}</Mono>
                  </TableCell>
                  <TableCell>{P(x.pid).name}</TableCell>
                  <TableCell>
                    {x.pass ? (
                      <Pill tone="success">Megfelel</Pill>
                    ) : (
                      <Pill tone="destructive">Zárolva</Pill>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {x.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Grid>
      <Grid cols={3}>
        {S.sites.map((s) => {
          const deps = S.depots.filter((d) => d.site === s.id);
          const tot = deps.reduce(
            (a, d) =>
              a + S.products.reduce((b, p) => b + stockOf(p.id, d.id), 0),
            0,
          );
          return (
            <Panel key={s.id}>
              <Spread>
                <h2>{s.name}</h2>
                <Mono>{tn(tot)}</Mono>
              </Spread>
              {deps.map((d) => {
                const ps = S.products.filter((p) => stockOf(p.id, d.id) !== 0);
                return (
                  <div key={d.id}>
                    <h3 className="mt-2">{d.name}</h3>
                    <Table>
                      <TableBody>
                        {ps.length ? (
                          ps.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.name}</TableCell>
                              <TableCell numeric>
                                {tn(stockOf(p.id, d.id))}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell className="text-xs text-muted-foreground">
                              üres
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </Panel>
          );
        })}
      </Grid>
      <Panel className="mt-3.5">
        <Spread>
          <h2>Összesítő</h2>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitStockMove(
                formValue(f, "mv-p"),
                formValue(f, "mv-t"),
                +formValue(f, "mv-q"),
              );
            }}
          >
            <Sel name="mv-p" aria-label="Termék">
              {productOptions}
            </Sel>
            <Sel name="mv-t" aria-label="Típus">
              <option>gyártás</option>
              <option>beszerzés</option>
              <option>helyesbítés</option>
              <option>saját felhasználás</option>
            </Sel>
            <Inp
              name="mv-q"
              type="number"
              step="0.1"
              defaultValue="100"
              className="w-22.5"
              aria-label="Mennyiség (t)"
            />
            <Btn kind="pri" type="submit">
              Könyvelés
            </Btn>
          </form>
        </Spread>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termék</TableHead>
              <TableHead>VTSZ</TableHead>
              <TableHead numeric>Készlet</TableHead>
              <TableHead numeric>Lekötött</TableHead>
              <TableHead numeric>Szabad</TableHead>
              <TableHead numeric>Minimum</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, total, res }) => {
              const free = total - res;
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <Mono>{p.vtsz}</Mono>
                  </TableCell>
                  <TableCell numeric>{tn(total)}</TableCell>
                  <TableCell numeric>{tn(res)}</TableCell>
                  <TableCell numeric>{tn(free)}</TableCell>
                  <TableCell numeric>{tn(p.min)}</TableCell>
                  <TableCell>
                    {free < 0 ? (
                      <Pill tone="destructive">Hiány</Pill>
                    ) : free < p.min ? (
                      <Pill tone="warning">Minimum alatt</Pill>
                    ) : (
                      <Pill tone="success">Rendben</Pill>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
      <Panel className="mt-3.5">
        <h2>Mozgásnapló (utolsó 12)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead>Termék</TableHead>
              <TableHead>Depó</TableHead>
              <TableHead>Típus</TableHead>
              <TableHead numeric>Mennyiség</TableHead>
              <TableHead>Hivatkozás</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...S.stockMoves]
              .sort(
                (a, b) =>
                  +new Date(b.date) - +new Date(a.date) ||
                  (b.id > a.id ? 1 : -1),
              )
              .slice(0, 12)
              .map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{ds(m.date)}</TableCell>
                  <TableCell>{P(m.pid).name}</TableCell>
                  <TableCell>{D(m.depot).name}</TableCell>
                  <TableCell>{m.type}</TableCell>
                  <TableCell numeric>
                    {m.qty > 0 ? "+" : ""}
                    {fmt(m.qty, 1)} t
                  </TableCell>
                  <TableCell>
                    <Mono>{m.ref}</Mono>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Panel>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Depók közötti átszállítás</h2>
          <form
            className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitTransfer(
                formValue(f, "tr-p"),
                formValue(f, "tr-a"),
                formValue(f, "tr-b"),
                +formValue(f, "tr-q"),
              );
            }}
          >
            <Field label="Termék">
              <Sel name="tr-p">{productOptions}</Sel>
            </Field>
            <Field label="Mennyiség (t)">
              <Inp name="tr-q" type="number" defaultValue="300" />
            </Field>
            <Field label="Honnan">
              <Sel name="tr-a">{depotOptions}</Sel>
            </Field>
            <Field label="Hová">
              <Sel name="tr-b" defaultValue={S.depots[1]?.id}>
                {depotOptions}
              </Sel>
            </Field>
            <Row>
              <Btn kind="pri" type="submit">
                Átszállítás könyvelése
              </Btn>
            </Row>
          </form>
        </Panel>
        <Panel>
          <h2>Depófelmérés (drón / GPS)</h2>
          <Small className="my-3">
            A felmért térfogat × halmazsűrűség összevetve a könyvi készlettel.
            3% feletti eltérésnél helyesbítési javaslat.
          </Small>
          <form
            className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              actions.submitSurvey(
                formValue(f, "sv-d"),
                formValue(f, "sv-p"),
                +formValue(f, "sv-m"),
              );
            }}
          >
            <Field label="Depó">
              <Sel name="sv-d">{depotOptions}</Sel>
            </Field>
            <Field label="Termék">
              <Sel name="sv-p">{productOptions}</Sel>
            </Field>
            <Field label="Mért térfogat (m³)">
              <Inp name="sv-m" type="number" defaultValue="1000" />
            </Field>
            <Row className="self-end">
              <Btn kind="pri" type="submit">
                Egyeztetés
              </Btn>
            </Row>
          </form>
          {S.surveys.length ? (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Felmérés</TableHead>
                  <TableHead>Depó · termék</TableHead>
                  <TableHead numeric>Mért</TableHead>
                  <TableHead numeric>Könyvi</TableHead>
                  <TableHead numeric>Eltérés</TableHead>
                  <TableHead>Állapot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {S.surveys.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">
                      {v.id}
                      <Small>{v.method}</Small>
                    </TableCell>
                    <TableCell>
                      {D(v.depot).name}
                      <Small>{P(v.pid).name}</Small>
                    </TableCell>
                    <TableCell numeric>
                      {tn(v.t)}
                      <Small>{fmt(v.m3)} m³</Small>
                    </TableCell>
                    <TableCell numeric>{tn(v.book)}</TableCell>
                    <TableCell numeric>{pct(v.rel)}</TableCell>
                    <TableCell>
                      <StatusPill status={v.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Panel>
      </Grid>
      <Panel className="mt-3.5">
        <h2>Készletfedezet</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termék</TableHead>
              <TableHead numeric>Napi átlagos eladás</TableHead>
              <TableHead numeric>Szabad készlet</TableHead>
              <TableHead>Hány napra elég</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cover.map((c) => (
              <TableRow key={c.p.id}>
                <TableCell>{c.p.name}</TableCell>
                <TableCell numeric>{tn(c.daily)}</TableCell>
                <TableCell numeric>{tn(c.free)}</TableCell>
                <TableCell>
                  <Row>
                    <Bar
                      className="flex-1"
                      pct={(c.days / 30) * 100}
                      tone={c.days < 5 ? "bad" : c.days < 10 ? "warn" : ""}
                      label={`${c.p.name} készletfedezet`}
                    />
                    <Mono>{c.days > 900 ? "—" : fmt(c.days, 1) + " nap"}</Mono>
                  </Row>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Small className="my-3">
          A törőüzem heti termelési tervét a Leltár-egyeztető ebből javasolja:
          ami 10 napon belül elfogy, az kerül előre.
        </Small>
      </Panel>
    </>
  );
}
