"use client";

import { ds } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
import { StatusPill } from "@/prototype/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  Btn,
  formValue,
  Grid,
  Head,
  Panel,
  Row,
  Small,
  Spread,
  TabBar,
} from "@/prototype/ui";
import { DocBlock, PhotoBtn, SigImg } from "./driverapp-parts";

const TABS: [string, string][] = [
  ["list", "Szerződések"],
  ["tpl", "Sablon"],
  ["reg", "Iktatókönyv"],
];
const KEYS = [
  "szerzodesszam",
  "ajanlatszam",
  "megrendelesszam",
  "vevo_nev",
  "vevo_cim",
  "vevo_adoszam",
  "szallitasi_cim",
  "tetelek",
  "fuvar",
  "osszeg_netto",
  "osszeg_brutto",
  "teljesitesi_idoszak",
  "fizetesi_hatarido",
  "datum",
];
const SHORT: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

// V.contracts with its three sub-tabs.
export function ContractsScreen() {
  const { view, actions } = useDemo();
  const sub = view.CS.sub;
  return (
    <>
      <Head
        title="Szerződések"
        sub="Sablonból készülő szerződés, elektronikus vagy fotós aláírás, iktatás hash-értékkel."
      />
      <TabBar
        items={TABS}
        active={sub}
        onSelect={(k) => actions.setContractTab(k)}
      />
      {sub === "list" ? <ContractList /> : null}
      {sub === "tpl" ? <TemplateEditor /> : null}
      {sub === "reg" ? <RegTable /> : null}
    </>
  );
}

function ContractList() {
  const { S, q, ui, actions } = useDemo();
  const cur =
    S.contracts.find((c) => c.id === ui.sel.contract) || S.contracts[0];
  return (
    <Grid cols={2}>
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Szerződés</TableHead>
              <TableHead>Vevő · megrendelés</TableHead>
              <TableHead>Kiküldve</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.contracts.length ? (
              S.contracts.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => actions.openContract(c.id)}
                >
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>
                    {c.clientName}
                    <Small>{c.order}</Small>
                  </TableCell>
                  <TableCell>{c.sent ? ds(c.sent) : "—"}</TableCell>
                  <TableCell>
                    <StatusPill status={c.status} />
                    {c.ik ? <Small className="font-mono">{c.ik}</Small> : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-xs text-muted-foreground"
                >
                  Még nincs szerződés.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Small className="my-3">
          Elfogadott ajánlatból a Szerződéskészítő automatikusan elkészíti a
          szerződést a sablonból, kiküldi a vevői portálra, figyeli az aláírást.
          Házirend: aláírt szerződés nélkül a diszpécser csak kivételként
          (naplózva) fogadhat el fuvart.
        </Small>
      </Panel>
      <div>
        {cur ? (
          <Panel>
            <Spread>
              <h2>{cur.id}</h2>
              <StatusPill status={cur.status} />
            </Spread>
            <DocBlock>{q.contractText(cur)}</DocBlock>
            {cur.sig ? (
              <>
                <Small>
                  Aláírta: {cur.signer} · {cur.signed?.toLocaleString("hu-HU")}
                </Small>
                <SigImg src={cur.sig} alt="Aláírás" />
              </>
            ) : null}
            <Row className="mt-2">
              {cur.status === "Piszkozat" ? (
                <Btn kind="pri" onClick={() => actions.sendContract(cur.id)}>
                  Kiküldés aláírásra
                </Btn>
              ) : null}
              {cur.status === "Kiküldve" ? (
                <>
                  <Btn onClick={() => actions.contractPortal(cur.id)}>
                    Megnyitás vevőként (portál)
                  </Btn>
                  <PhotoBtn
                    accept="image/*,.pdf"
                    onPhoto={(img, name) =>
                      actions.photoUpload("contract", cur.id, img, name)
                    }
                  >
                    Aláírt példány feltöltése
                  </PhotoBtn>
                  <Btn sm onClick={() => actions.remindContract(cur.id)}>
                    Emlékeztető
                  </Btn>
                </>
              ) : null}
            </Row>
            <h3 className="mt-2.5">Előzmények</h3>
            {cur.history.map((h, i) => (
              <Small key={i}>
                {new Date(h[0]).toLocaleString("hu-HU", SHORT)} · {h[1]} —{" "}
                {h[2]}
              </Small>
            ))}
          </Panel>
        ) : null}
      </div>
    </Grid>
  );
}

function TemplateEditor() {
  const { S, actions } = useDemo();
  return (
    <Panel>
      <form onSubmit={(e) => e.preventDefault()}>
        <h2>Szerződéssablon</h2>
        <Small className="my-3">
          Helyőrzők:{" "}
          {KEYS.map((k, i) => (
            <span key={k}>
              {i ? " " : ""}
              <code>{`{{${k}}}`}</code>
            </span>
          ))}
          . A módosítás az új szerződésekre vonatkozik; a már kiküldöttek nem
          változnak.
        </Small>
        <Area
          name="tpl-t"
          rows={24}
          defaultValue={S.ctemplate}
          aria-label="Szerződéssablon"
        />
        <Row className="mt-2">
          <Btn
            kind="pri"
            onClick={(e) =>
              actions.saveTemplate(formValue(e.currentTarget.form, "tpl-t"))
            }
          >
            Sablon mentése
          </Btn>
        </Row>
      </form>
    </Panel>
  );
}

// regTable(): the registry of signed documents.
function RegTable() {
  const { S } = useDemo();
  return (
    <Panel>
      <h2>Iktatókönyv</h2>
      <Small className="my-3">
        Minden aláírt szerződés, TIG és aláírt szállítólevél-fotó iktatószámot
        és SHA-256 lenyomatot kap; utólagos módosítás a lenyomat eltéréséből
        kiderül.
      </Small>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Iktatószám</TableHead>
            <TableHead>Dátum</TableHead>
            <TableHead>Típus</TableHead>
            <TableHead>Tárgy</TableHead>
            <TableHead>Beküldő</TableHead>
            <TableHead>SHA-256</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {S.registry.length ? (
            S.registry.map((r) => (
              <TableRow key={r.no}>
                <TableCell className="font-mono text-xs">{r.no}</TableCell>
                <TableCell>{r.date.toLocaleString("hu-HU", SHORT)}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.by}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.hash.slice(0, 16)}…
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-xs text-muted-foreground">
                Üres.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}
