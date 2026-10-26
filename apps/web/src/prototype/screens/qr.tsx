"use client";

import { fmt, ft } from "@mine-erp/domain/demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDemo } from "@/prototype/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Btn,
  formValue,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Row,
  Small,
  TabBar,
} from "@/prototype/ui";
import { decodeQrPhoto, useQrImage } from "./qr-parts";

const TABS: [string, string][] = [
  ["scan", "Szkennelés"],
  ["labels", "Címkék"],
  ["log", "QR-napló"],
  ["proj", "Projektek, egységek"],
];
const MD: Record<string, string> = {
  receive: "Bevételezés",
  issue: "Kiadás",
  move: "Áthelyezés",
  count: "Leltár",
};

/** Value of the quantity field when it is shown (the demo's `if(q)SCAN.qty=q.value`). */
const qtyField = () => {
  const el = document.getElementById("qr-qty");
  return el instanceof HTMLInputElement ? el.value : undefined;
};

// V.qr: scan, labels, QR log and project tabs.
export function QrScreen() {
  const { view, actions } = useDemo();
  const sub = view.QS.sub;
  return (
    <>
      <Head
        title="QR raktár"
        sub="Minden cikk, raktárhely, gép, tehergépkocsi, projekt, egység és munkalap QR-azonosítót kap. Bevételezés, kiadás, áthelyezés és leltár szkenneléssel; kiadás csak céllal együtt rögzíthető, így a költség mindig a megfelelő helyre kerül."
      />
      <TabBar items={TABS} active={sub} onSelect={(k) => actions.setQrTab(k)} />
      {sub === "scan" ? <ScanTab /> : null}
      {sub === "labels" ? <LabelsTab /> : null}
      {sub === "log" ? <LogTab /> : null}
      {sub === "proj" ? <ProjTab /> : null}
    </>
  );
}

function ScanTab() {
  const { S, q, view, actions } = useDemo();
  const SCAN = view.SCAN;
  const p = SCAN.item && S.parts.find((x) => x.id === SCAN.item!.ref);
  const chip = (code: string, label: string) => (
    <Btn key={code} sm onClick={() => actions.qrScan(code, qtyField())}>
      {label}
    </Btn>
  );
  return (
    <Grid cols={2}>
      <Panel>
        <Row>
          {Object.entries(MD).map(([k, l]) => (
            <Btn
              key={k}
              kind={SCAN.mode === k ? "pri" : "default"}
              onClick={() => actions.setScanMode(k)}
            >
              {l}
            </Btn>
          ))}
        </Row>
        <div className="mt-3 rounded-lg border-2 border-dashed border-primary p-3">
          <Small>{SCAN.msg}</Small>
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              actions.qrScan(
                formValue(e.currentTarget, "qr-in"),
                qtyField(),
                false,
              );
              // The screen remounts after the engine render; focus the new input.
              setTimeout(() => document.getElementById("qr-in")?.focus(), 0);
            }}
          >
            <Inp
              id="qr-in"
              name="qr-in"
              placeholder="Kézi vagy vonalkódolvasós bevitel, pl. MP-CIKK-S3"
              autoComplete="off"
              className="min-w-50 flex-1"
              aria-label="QR-kód"
            />
            <Btn kind="pri" type="submit">
              Beolvas
            </Btn>
          </form>
          <Row className="mt-2">
            <label
              className={cn(
                buttonVariants({ variant: "outline" }),
                "cursor-pointer text-control",
              )}
            >
              Fotó a QR-kódról
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file)
                    void decodeQrPhoto(file).then((code) =>
                      actions.qrPhoto(code),
                    );
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">
              A telefon kamerájával lefotózott címkét a rendszer dekódolja;
              ipari olvasó billentyűzetként ír a mezőbe.
            </span>
          </Row>
        </div>
        <Table className="mt-2.5">
          <TableBody>
            <TableRow>
              <TableCell>Cikk</TableCell>
              <TableCell>
                {SCAN.item ? (
                  <>
                    <b>{SCAN.item.name}</b>{" "}
                    <Mono className="text-muted-foreground">
                      {SCAN.item.code}
                    </Mono>
                    {p ? (
                      <Small>
                        készlet {fmt(p.qty)} {p.unit} · hely {p.loc}
                      </Small>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
            {SCAN.mode === "receive" ? (
              <TableRow>
                <TableCell>Rendelés</TableCell>
                <TableCell>
                  {SCAN.po ? SCAN.po.name : "— (opcionális)"}
                </TableCell>
              </TableRow>
            ) : null}
            {SCAN.mode === "issue" ? (
              <TableRow>
                <TableCell>Cél</TableCell>
                <TableCell>
                  {SCAN.target ? (
                    <b>
                      {SCAN.target.kind}: {SCAN.target.name}
                    </b>
                  ) : (
                    "— kötelező"
                  )}
                </TableCell>
              </TableRow>
            ) : null}
            {SCAN.mode !== "issue" ? (
              <TableRow>
                <TableCell>Raktárhely</TableCell>
                <TableCell>{SCAN.loc ? SCAN.loc.name : "—"}</TableCell>
              </TableRow>
            ) : null}
            {SCAN.mode !== "move" ? (
              <TableRow>
                <TableCell>Mennyiség</TableCell>
                <TableCell>
                  <Inp
                    id="qr-qty"
                    type="number"
                    step="0.1"
                    defaultValue={SCAN.qty}
                    className="w-27.5"
                    aria-label="Mennyiség"
                  />{" "}
                  {p ? p.unit : ""}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Row className="mt-2">
          <Btn kind="pri" onClick={() => actions.qrCommit(qtyField())}>
            {MD[SCAN.mode]} rögzítése
          </Btn>
          <Btn sm onClick={() => actions.setScanMode(SCAN.mode)}>
            Újrakezdés
          </Btn>
        </Row>
      </Panel>
      <Panel>
        <h2>Gyors szkennelés (demó)</h2>
        <p className="my-3 text-xs text-muted-foreground">
          Kattintás = a címke beolvasása.
        </p>
        <h3>Cikkek</h3>
        <div className="flex flex-wrap gap-1.5">
          {q.qrItems().map((i) => chip(i.code, i.name))}
        </div>
        <h3 className="mt-2">Célok</h3>
        <div className="flex flex-wrap gap-1.5">
          {q.qrTargets().map((i) => chip(i.code, `${i.kind}: ${i.name}`))}
        </div>
        <h3 className="mt-2">Raktárhelyek és rendelések</h3>
        <div className="flex flex-wrap gap-1.5">
          {[...q.qrLocs(), ...q.qrPOs()].map((i) => chip(i.code, i.name))}
        </div>
      </Panel>
    </Grid>
  );
}

function QrLabel({ code, name }: { code: string; name: string }) {
  const { actions } = useDemo();
  const src = useQrImage(code);
  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-lg border border-border bg-card p-2 text-center"
      onClick={() => actions.qrScan(code)}
      onKeyDown={(e) => {
        if (e.key === "Enter") actions.qrScan(code);
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing for next/image to optimise
        <img
          src={src}
          alt={`QR: ${code}`}
          className="mx-auto block size-27.5 rounded-sm"
        />
      ) : (
        <div className="mx-auto grid size-27.5 place-items-center bg-muted">
          QR
        </div>
      )}
      <Mono className="block text-muted-foreground">{code}</Mono>
      <Small>{name}</Small>
    </div>
  );
}

function LabelsTab() {
  const { q } = useDemo();
  const groups: [string, { code: string; name: string }[]][] = [
    ["Cikkek", q.qrItems()],
    ["Raktárhelyek", q.qrLocs()],
    ["Gépek, tehergépkocsik, projektek, egységek, munkalapok", q.qrTargets()],
    ["Nyitott beszerzési rendelések", q.qrPOs()],
  ];
  return (
    <>
      {groups.map(([g, xs]) => (
        <Panel key={g} className="mb-3.5">
          <h2>{g}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {xs.length ? (
              xs.map((x) => (
                <QrLabel key={x.code} code={x.code} name={x.name} />
              ))
            ) : (
              <p className="my-3 text-xs text-muted-foreground">Nincs.</p>
            )}
          </div>
        </Panel>
      ))}
      <p className="my-3 text-xs text-muted-foreground">
        Címkenyomtatás élesben ipari címkenyomtatóval (pl. Zebra, ZPL),
        időjárásálló címkével; a gépeken és teherautókon a vezetőfülkében.
      </p>
    </>
  );
}

function LogTab() {
  const { S } = useDemo();
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Idő</TableHead>
            <TableHead>Művelet</TableHead>
            <TableHead>Cikk</TableHead>
            <TableHead numeric>Menny.</TableHead>
            <TableHead>Hova / mit</TableHead>
            <TableHead numeric>Érték</TableHead>
            <TableHead>Költséghely</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {S.qrlog.length ? (
            S.qrlog.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(l.t).toLocaleString("hu-HU", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>{l.mode}</TableCell>
                <TableCell>
                  {l.item}
                  <Mono className="block text-muted-foreground">{l.code}</Mono>
                </TableCell>
                <TableCell numeric>
                  {fmt(l.qty, l.qty % 1 ? 1 : 0)} {l.unit}
                </TableCell>
                <TableCell>
                  {l.to}
                  <Mono className="block text-muted-foreground">{l.tcode}</Mono>
                </TableCell>
                <TableCell numeric>{ft(l.cost)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.costTo}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-xs text-muted-foreground">
                Még nincs QR-mozgás.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}

function ProjTab() {
  const { S } = useDemo();
  const pc = S.projCost || [];
  const sum = (ref: string) =>
    ft(pc.filter((x) => x.ref === ref).reduce((a, x) => a + x.cost, 0));
  return (
    <Grid cols={2}>
      <Panel>
        <h2>Projektek</h2>
        <Table>
          <TableBody>
            {S.projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.name}
                  <Mono className="block text-muted-foreground">
                    MP-PRJ-{p.id}
                  </Mono>
                </TableCell>
                <TableCell numeric>{sum(p.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel>
        <h2>Egységek</h2>
        <Table>
          <TableBody>
            {S.units.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {u.name}
                  <Mono className="block text-muted-foreground">
                    MP-EGY-{u.id}
                  </Mono>
                </TableCell>
                <TableCell numeric>{sum(u.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="my-3 text-xs text-muted-foreground">
          A gépre és tehergépkocsira kiadott tétel a gépköltségbe, onnan a
          termék önköltségébe kerül; a projekt- és egységköltség külön
          riportban.
        </p>
      </Panel>
    </Grid>
  );
}
