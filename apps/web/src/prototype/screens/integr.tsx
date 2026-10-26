"use client";

import { useDemo } from "@/prototype/store";
import { Pill, type PillTone } from "@/components/ui/pill";
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
  Grid,
  Head,
  Json,
  Mono,
  Panel,
  Row,
  Small,
  Stack,
} from "@/prototype/ui";

const jobTone = (s: string): PillTone =>
  s === "Sikeres"
    ? "success"
    : s === "Újrapróbálás"
      ? "warning"
      : s === "Sorban"
        ? "neutral"
        : "destructive";

export function IntegrScreen() {
  const { S, actions, ui } = useDemo();
  const cur = S.jobs.find((j) => j.id === ui.sel.job);
  return (
    <>
      <Head
        title="Integrációk"
        sub="Minden külső hívás (NAV EKÁER, Billingo) egy kimenő soron megy át: idempotencia-kulccsal, automatikus újrapróbálással, hiba esetén emberi döntéssel. Semmi nem vész el és semmi nem megy ki kétszer."
      />
      <Grid cols={2}>
        <Panel>
          <h2>Kapcsolatok</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rendszer</TableHead>
                <TableHead>Hitelesítés</TableHead>
                <TableHead>Állapot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.conn.map((c) => {
                const down =
                  (/EKÁER/.test(c.sys) && S.sim.ekaerDown) ||
                  (/Billingo/.test(c.sys) && S.sim.billingoDown);
                return (
                  <TableRow key={c.sys}>
                    <TableCell>
                      <b>{c.sys}</b>
                      <Small>{c.scope}</Small>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.auth}
                    </TableCell>
                    <TableCell>
                      {down ? (
                        <Pill tone="destructive">Nem elérhető</Pill>
                      ) : (
                        <Pill tone="success">Kapcsolódva</Pill>
                      )}
                      <Small>{c.last}</Small>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
        <Panel>
          <h2>Hibatűrés kipróbálása</h2>
          <p className="my-3 text-xs text-muted-foreground">
            Kapcsolja ki az egyik szolgáltatást, majd zárjon le egy fuvart vagy
            jelentsen be egy EKÁER-t: a feladat újrapróbálásra kerül, 3 hiba
            után döntést kér, a fuvar addig nem indulhat.
          </p>
          <Stack>
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={S.sim.ekaerDown}
                onChange={(e) => actions.setSimEkaer(e.currentTarget.checked)}
              />{" "}
              NAV EKÁER üzemszünet szimulálása
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={S.sim.billingoDown}
                onChange={(e) =>
                  actions.setSimBillingo(e.currentTarget.checked)
                }
              />{" "}
              Billingo hiba szimulálása
            </label>
            <Row>
              <Btn onClick={() => actions.syncClick()}>
                Fizetések lekérdezése a Billingóból
              </Btn>
              <Btn onClick={() => actions.retryAll()}>
                Minden hibás feladat újrapróbálása
              </Btn>
            </Row>
          </Stack>
        </Panel>
      </Grid>
      <Grid cols={cur ? 2 : 1} className="mt-3.5">
        <Panel>
          <h2>Kimenő sor</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feladat</TableHead>
                <TableHead>Rendszer · művelet</TableHead>
                <TableHead>Hivatkozás</TableHead>
                <TableHead numeric>Próba</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.jobs.map((j) => (
                <TableRow
                  key={j.id}
                  className="cursor-pointer"
                  onClick={() => actions.selectJob(j.id)}
                >
                  <TableCell className="font-mono">{j.id}</TableCell>
                  <TableCell>
                    {j.system}
                    <Small>{j.op}</Small>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {j.ref}
                  </TableCell>
                  <TableCell numeric>{j.attempts}</TableCell>
                  <TableCell>
                    <Pill tone={jobTone(j.status)}>{j.status}</Pill>
                  </TableCell>
                  <TableCell>
                    {j.status !== "Sikeres" ? (
                      <Btn
                        sm
                        onClick={(e) => {
                          // The demo's closest() picks the button, not the row.
                          e.stopPropagation();
                          actions.retryClick(j.id);
                        }}
                      >
                        Újra
                      </Btn>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        {cur ? (
          <Panel>
            <h2>{cur.id}</h2>
            <p className="my-3 text-xs text-muted-foreground">
              {cur.system} · {cur.op} · idempotencia-kulcs:{" "}
              <Mono>{cur.idem}</Mono>
            </p>
            <p>
              Válasz: <Mono>{cur.resp || "—"}</Mono>
            </p>
            <h3>Kérés</h3>
            <Json value={cur.payload} />
          </Panel>
        ) : null}
      </Grid>
    </>
  );
}
