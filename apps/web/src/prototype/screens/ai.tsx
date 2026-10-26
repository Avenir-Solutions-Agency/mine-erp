"use client";

import {
  ds,
  kindName,
  type AgentMode,
  type Policy,
} from "@mine-erp/domain/demo";
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
  AiBox,
  Alert,
  Btn,
  Field,
  Grid,
  Head,
  Inp,
  Mono,
  Panel,
  Row,
  Sel,
  Small,
  Stack,
} from "@/prototype/ui";

const POLICY: [
  keyof Pick<
    Policy,
    | "autoQuoteMaxNet"
    | "autoInvoiceMaxGross"
    | "overDeliveryTol"
    | "freightMarkup"
  >,
  string,
  boolean,
][] = [
  ["autoQuoteMaxNet", "Auto-küldhető ajánlat max. nettó (Ft)", false],
  ["autoInvoiceMaxGross", "Auto-számla max. bruttó (Ft)", false],
  ["overDeliveryTol", "Túlszállítási tűrés (%)", true],
  ["freightMarkup", "Fuvardíj-felár (%)", true],
];

// V.ai with the round-2 phase table before the agents panel.
export function AiScreen() {
  const { S, actions, consts } = useDemo();
  const open = S.approvals.filter((a) => a.status === "Vár");
  const done = S.approvals.filter((a) => a.status !== "Vár");

  return (
    <>
      <Head
        title="Jóváhagyások és AI"
        sub="Minden folyamatlépést AI-ügynök végez; hogy önállóan vagy csak javaslatként, azt itt állítja. Minden művelet naplózott és visszakövethető."
      />
      <Grid cols={2}>
        <Stack>
          <Panel>
            <h2>Döntésre vár ({open.length})</h2>
            {open.length ? (
              open.map((a) => (
                <AiBox
                  key={a.id}
                  who={kindName(a.kind) ?? ""}
                  className="relative mb-2.5"
                >
                  <span className="absolute top-3 right-3.5 text-xs text-muted-foreground">
                    {ds(a.t)}
                  </span>
                  <h3 className="mt-1">{a.title}</h3>
                  <p className="my-0.5 text-xs text-muted-foreground">
                    Miért ember dönt: {a.reason}
                  </p>
                  <p className="my-1">{a.ai}</p>
                  <Row>
                    <Btn
                      kind="pri"
                      sm
                      onClick={() => actions.decide(a.id, true)}
                    >
                      Jóváhagyom
                    </Btn>
                    <Btn
                      kind="bad"
                      sm
                      onClick={() => actions.decide(a.id, false)}
                    >
                      Elutasítom
                    </Btn>
                    {a.kind === "quote" ? (
                      <Btn sm onClick={() => actions.openQuote(a.refId)}>
                        Ajánlat
                      </Btn>
                    ) : null}
                  </Row>
                </AiBox>
              ))
            ) : (
              <p className="my-3 text-xs text-muted-foreground">
                Minden döntés lezárva.
              </p>
            )}
          </Panel>
          <Panel>
            <h2>Lezárt döntések</h2>
            {done.length ? (
              done.map((a) => (
                <Alert
                  key={a.id}
                  lvl={a.status === "Jóváhagyva" ? "ok" : "bad"}
                >
                  {a.title} — {a.status}
                </Alert>
              ))
            ) : (
              <p className="my-3 text-xs text-muted-foreground">—</p>
            )}
          </Panel>
        </Stack>
        <Stack>
          <Panel>
            <h2>Folyamat-fázisok: ki dolgozik, hol dönt ember</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fázis</TableHead>
                  <TableHead>AI-ügynök</TableHead>
                  <TableHead>Mit csinál</TableHead>
                  <TableHead>Emberi döntés, ha…</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consts.PHASES.map((p) => (
                  <TableRow key={p[0]}>
                    <TableCell>
                      <b>{p[0]}</b>
                    </TableCell>
                    <TableCell>{p[1]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p[2]}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p[3]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <h2>Ügynökök és önállóság</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ügynök</TableHead>
                  <TableHead>Mód</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {S.agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <b>{a.name}</b>
                      <Small>{a.does}</Small>
                    </TableCell>
                    <TableCell>
                      <Sel
                        aria-label={`${a.name} módja`}
                        defaultValue={a.mode}
                        onCommit={(el) =>
                          actions.setAgentMode(
                            a.id,
                            el.value as AgentMode,
                            el.selectedOptions[0]?.text ?? "",
                          )
                        }
                      >
                        <option value="auto">Önálló, házirenden belül</option>
                        <option value="suggest">Csak javasol</option>
                        <option value="off">Kikapcsolva</option>
                      </Sel>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <h2>Házirend</h2>
            <Grid cols={2}>
              {POLICY.map(([k, l, isPct]) => (
                <Field key={k} label={l}>
                  <Inp
                    type="number"
                    defaultValue={isPct ? S.policy[k] * 100 : S.policy[k]}
                    onCommit={(el) =>
                      isPct
                        ? actions.setPolicyPct(k, el.value)
                        : actions.setPolicy(k, el.value)
                    }
                  />
                </Field>
              ))}
            </Grid>
          </Panel>
          <Panel>
            <h2>Napló</h2>
            <div className="max-h-90 overflow-auto">
              {S.audit.slice(0, 40).map((a, i) => (
                <Alert key={i} lvl={/^AI/.test(a.actor) ? "ai" : ""}>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.t).toLocaleString("hu-HU", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {a.actor}
                  </span>
                  <div>
                    {a.what}{" "}
                    <Mono className="text-muted-foreground">{a.ref}</Mono>
                  </div>
                </Alert>
              ))}
            </div>
          </Panel>
        </Stack>
      </Grid>
    </>
  );
}
