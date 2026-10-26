"use client";

import { ds, fmt, ft, stageName } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
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
import { Btn, Head, Mono, Panel, Small, Spread } from "@/prototype/ui";

// V.machines with the round-5 machine log panel.
export function MachinesScreen() {
  const demo = useDemo();
  const { S, q } = demo;
  const cm = q.costModel();
  const prodT = Object.values(cm.prodT).reduce((a, b) => a + b, 0);
  const stT: Record<string, number> = {
    kitermeles: prodT,
    toro: prodT,
    rakodas: cm.totSold,
    fuvar: cm.totSold,
  };

  return (
    <>
      <Head
        title="Gépek"
        sub="Havi gépköltség: értékcsökkenés + üzemanyag + alkatrész/kiadás + útdíj. Üzemórára, tonnára és km-re vetítve."
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gép</TableHead>
              <TableHead>Fázis</TableHead>
              <TableHead numeric>Üzemóra</TableHead>
              <TableHead numeric>ÉCS</TableHead>
              <TableHead numeric>Üzemanyag</TableHead>
              <TableHead numeric>Alkatrész</TableHead>
              <TableHead numeric>Összesen</TableHead>
              <TableHead numeric>Ft/üzemóra</TableHead>
              <TableHead numeric>Ft/t</TableHead>
              <TableHead>Szerviz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cm.mach.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.name}</TableCell>
                <TableCell>{stageName(m.stage)}</TableCell>
                <TableCell numeric>{fmt(m.h)}</TableCell>
                <TableCell numeric>{ft(m.dep)}</TableCell>
                <TableCell numeric>
                  {ft(m.fuelFt)}
                  <Small>{fmt(m.fuel)} l</Small>
                </TableCell>
                <TableCell numeric>{ft(m.parts + m.extra)}</TableCell>
                <TableCell numeric>{ft(m.total)}</TableCell>
                <TableCell numeric>{ft(m.perH)}</TableCell>
                <TableCell numeric>{ft(m.total / stT[m.stage])}</TableCell>
                <TableCell>
                  {m.stage === "fuvar" ? (
                    <Pill tone={m.next < 2000 ? "warning" : "neutral"}>
                      {fmt(m.next)} km
                    </Pill>
                  ) : (
                    <Pill
                      tone={
                        m.next < 50
                          ? "destructive"
                          : m.next < 120
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {fmt(m.next)} óra
                    </Pill>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>Összesen</TableCell>
              <TableCell numeric>
                {ft(cm.mach.reduce((a, m) => a + m.total, 0))}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
        <p className="my-3 text-xs text-muted-foreground">
          Saját flotta: {fmt(cm.km)} km a hónapban, teljes fuvarköltség (gép +
          sofőrbér) {ft(cm.pools.fuvar)} → <b>{ft(cm.ftPerKm)}/km</b>. Ezzel
          számol az árazó.
        </p>
      </Panel>
      <Panel className="mt-3.5">
        <Spread>
          <h2>Digitális gépüzemnapló</h2>
          <Btn sm onClick={() => demo.go("operapp")}>
            Gépkezelő app
          </Btn>
        </Spread>
        <p className="my-3 text-xs text-muted-foreground">
          Adatforrás-sorrend: szalagmérleg / PLC → rakodó kanálmérlege → kezelői
          jelentés. Ahol automatikus adat van, a kezelő csak jóváhagy.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Napló</TableHead>
              <TableHead>Nap</TableHead>
              <TableHead>Gép</TableHead>
              <TableHead>Kezelő</TableHead>
              <TableHead>Forrás</TableHead>
              <TableHead numeric>Óraállás</TableHead>
              <TableHead numeric>Üzem</TableHead>
              <TableHead numeric>Állás</TableHead>
              <TableHead>Ok</TableHead>
              <TableHead>Termelés</TableHead>
              <TableHead>Hiba</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {S.mlog.map((x) => (
              <TableRow key={x.id}>
                <TableCell>
                  <Mono>{x.id}</Mono>
                </TableCell>
                <TableCell>{ds(x.date)}</TableCell>
                <TableCell>{x.machine}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {x.operator}
                </TableCell>
                <TableCell>
                  <Pill
                    tone={
                      /szalag|telem|PLC/.test(x.src) ? "success" : "neutral"
                    }
                  >
                    {x.src}
                  </Pill>
                </TableCell>
                <TableCell numeric>{fmt(x.hEnd, 1)}</TableCell>
                <TableCell numeric>{fmt(x.run, 1)} h</TableCell>
                <TableCell numeric>{fmt(x.idle, 1)} h</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {x.idleReason || ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {x.prod
                    ? Object.entries(x.prod)
                        .map(
                          ([p, t]) =>
                            `${q.P(p).name.split(" ")[0]}: ${fmt(t)} t`,
                        )
                        .join(" · ")
                    : x.feed
                      ? `feladás ${fmt(x.feed)} t`
                      : ""}
                </TableCell>
                <TableCell className="text-xs text-destructive">
                  {x.fault || ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
