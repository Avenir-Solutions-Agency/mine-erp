"use client";

import { ds, fmt, tn } from "@mine-erp/domain/demo";
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
import { Bar, Btn, Head, Mono, Panel, Row, Small } from "@/prototype/ui";

const sum = (r: Record<string, number>) =>
  Object.values(r).reduce((a, b) => a + b, 0);

export function OrdersScreen() {
  const { S, q, actions } = useDemo();
  return (
    <>
      <Head
        title="Megrendelések"
        sub="Megrendelés csak elfogadott ajánlatból vagy a vevői portálon keletkezik. A teljesítés a lezárt mérlegjegyekből számol, a túlszállítást a rendszer megállítja."
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sorszám</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Tételek · teljesítés</TableHead>
              <TableHead>Szállítás</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.orders.length ? (
              S.orders.map((o) => {
                const closed = S.transports.filter(
                  (f) => f.order === o.id && f.status === "Lezárva",
                );
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Mono>{o.id}</Mono>
                      <Small>{o.quote}</Small>
                    </TableCell>
                    <TableCell>{o.clientName}</TableCell>
                    <TableCell>
                      {o.lines.map((l, k) => {
                        const d = o.delivered[l.pid] || 0;
                        const pl = o.planned[l.pid] || 0;
                        return (
                          <div key={k} className="mb-1">
                            {q.P(l.pid).name}
                            <Row>
                              <Bar
                                pct={(d / l.qty) * 100}
                                label={`${q.P(l.pid).name} teljesítés`}
                                className="flex-1"
                              />
                              <Mono>
                                {fmt(d, 1)} / {fmt(l.qty)} t
                              </Mono>
                            </Row>
                            <Small>tervezett fuvarban: {tn(pl)}</Small>
                          </div>
                        );
                      })}
                    </TableCell>
                    <TableCell>
                      {o.zip} {o.city || ""}
                      <Small>{ds(o.date)}</Small>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={o.status} />
                    </TableCell>
                    <TableCell>
                      <Row>
                        {sum(o.planned) + sum(o.delivered) <
                        o.lines.reduce((a, l) => a + l.qty, 0) - 0.1 ? (
                          <Btn
                            kind="ai"
                            sm
                            onClick={() => actions.planClick(o.id)}
                          >
                            Fuvarok ütemezése
                          </Btn>
                        ) : null}
                        {closed.some((f) => !f.tig) ? (
                          <Btn sm onClick={() => actions.makeTig(o.id)}>
                            TIG a lezárt fuvarokból
                          </Btn>
                        ) : null}
                        {closed.some((f) => !f.inv && q.tigOk(f)) ? (
                          <Btn sm onClick={() => actions.invoiceClick(o.id)}>
                            Számla (elfogadott TIG)
                          </Btn>
                        ) : null}
                      </Row>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-xs text-muted-foreground"
                >
                  Még nincs megrendelés. Fogadjon el egy kiküldött ajánlatot.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
