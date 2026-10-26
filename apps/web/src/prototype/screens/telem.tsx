"use client";

import { ds, fmt } from "@mine-erp/domain/demo";
import { useDemo } from "@/prototype/store";
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
  AiBox,
  Alert,
  Btn,
  Grid,
  Head,
  Panel,
  Sel,
  Small,
  Spread,
  Stack,
} from "@/prototype/ui";

const W = 720,
  H = 420;
const lon0 = 17.6,
  lon1 = 19.5,
  lat0 = 46.8,
  lat1 = 47.62;
const X = (lo: number) => ((lo - lon0) / (lon1 - lon0)) * W;
const Y = (la: number) => H - ((la - lat0) / (lat1 - lat0)) * H;
const pts = (ps: number[][]) =>
  ps.map((p) => `${X(p[1])},${Y(p[0])}`).join(" ");
const BAL = pts([
  [46.71, 17.24],
  [46.8, 17.4],
  [46.87, 17.62],
  [46.93, 17.82],
  [46.97, 17.98],
  [46.95, 18.1],
  [46.9, 18.12],
  [46.85, 17.95],
  [46.78, 17.7],
  [46.72, 17.45],
]);
const VELENCE = pts([
  [47.24, 18.53],
  [47.25, 18.62],
  [47.21, 18.66],
  [47.2, 18.56],
]);
const M7 = pts([
  [47.47, 19.0],
  [47.3, 18.75],
  [47.2, 18.47],
  [47.06, 18.25],
  [46.95, 18.08],
  [46.86, 17.85],
]);
const M8 = pts([
  [47.2, 18.47],
  [47.12, 18.15],
  [47.09, 17.91],
]);

/** mapSVG(highlight): schematic base map, trip polylines (click selects) and truck markers. */
function MapSvg({ highlight }: { highlight: string | null }) {
  const { S, actions, consts } = useDemo();
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Járművek és útvonalak térképe"
        className="min-w-140 fill-muted-foreground font-mono"
        fontSize={10}
      >
        <rect width={W} height={H} fill="var(--muted)" />
        <polygon points={BAL} fill="var(--map-water)" stroke="var(--border)" />
        <polygon points={VELENCE} fill="var(--map-water)" />
        <polyline
          points={M7}
          fill="none"
          stroke="var(--map-road)"
          strokeWidth={3}
        />
        <polyline
          points={M8}
          fill="none"
          stroke="var(--map-road)"
          strokeWidth={2}
        />
        <text x={X(18.62)} y={Y(47.34)}>
          M7
        </text>
        {Object.entries(consts.GEO).map(([k, g]) => (
          <g key={k}>
            <circle
              cx={X(g[1])}
              cy={Y(g[0])}
              r={k.length === 3 ? 5 : 3.5}
              fill={
                k.length === 3 ? "var(--primary)" : "var(--muted-foreground)"
              }
            />
            <text x={X(g[1]) + 7} y={Y(g[0]) + 4} className="fill-foreground">
              {g[2]}
            </text>
          </g>
        ))}
        {S.trips.map((tr, i) => {
          const hl = !!highlight && tr.fid === highlight;
          return (
            <polyline
              key={`${tr.fid}-${i}`}
              points={tr.pts.map((p) => X(p[1]) + "," + Y(p[0])).join(" ")}
              fill="none"
              stroke={hl ? "var(--ai)" : "var(--primary)"}
              strokeWidth={hl ? 4 : 1.5}
              opacity={hl ? 1 : 0.35}
              className="cursor-pointer"
              onClick={() => actions.selectTrip(tr.fid)}
            >
              <title>{`${tr.fid} · ${tr.truck} · ${tr.from} → ${tr.to}`}</title>
            </polyline>
          );
        })}
        {Object.entries(S.telem).map(([id, t]) => (
          <g key={id}>
            <rect
              x={X(t.lon) - 24}
              y={Y(t.lat) - 22}
              width={48}
              height={15}
              rx={3}
              fill={t.speed ? "var(--ai)" : "var(--foreground)"}
            />
            <text
              x={X(t.lon)}
              y={Y(t.lat) - 11}
              textAnchor="middle"
              fontSize={9.5}
              className="fill-background"
            >
              {id}
            </text>
            <circle
              cx={X(t.lon)}
              cy={Y(t.lat)}
              r={4}
              fill={t.speed ? "var(--ai)" : "var(--foreground)"}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

const API_ROWS: [string, string, string][] = [
  ["Járművek listája", "rendszám-párosítás a járműtörzzsel", "naponta"],
  [
    "Utolsó érvényes pozíció, aktuális sebesség",
    "térkép, „hol az autó” a diszpécsernek és a vevői portálon (ETA)",
    "1–2 percenként",
  ],
  [
    "Pozíciók intervallumra",
    "útvonal-visszajátszás, kifogáskezelés, km-alapú költség",
    "forduló lezárásakor",
  ],
  [
    "Útvonalak intervallumra",
    "km, menetidő, üzemóra járművenként, sofőrönként; bérszámfejtés menetideje",
    "óránként",
  ],
  [
    "Események intervallumra",
    "gyorshajtás, hirtelen fékezés, alapjárat → eco-pont; POI-érkezés/-távozás → állásidő",
    "óránként",
  ],
  [
    "Mérőcsatornák aktuális értéke",
    "üzemanyagszint, km-óra → szervizig hátralévő km, tankolási figyelmeztetés",
    "15 percenként",
  ],
  [
    "Detektált tankolások",
    "összevetés kúti kiadással és kártyás számlával (üzemanyag-ellenőrzés)",
    "naponta",
  ],
  [
    "POI és POI-csoport létrehozása, módosítása",
    "minden szállítási címre és bányára automatikus POI (geokerítés)",
    "új címnél",
  ],
];

// V.telem
export function TelemScreen() {
  const { S, q, actions, view } = useDemo();
  const sel = view.TSUB.sel;
  const tr = S.trips.find((x) => x.fid === sel);
  return (
    <>
      <Head
        title="Telematika (iTrack)"
        sub="iTrack WebService (REST API) integráció: pozíció, útvonal, események, mérőcsatornák (üzemanyagszint, km-óra), detektált tankolások, POI. Az adatokból tartja karban a rendszer a járművek és sofőrök paramétereit, és ebből számolja az állásidőt és a fogyasztást."
        right={<Btn onClick={actions.itsyncClick}>Szinkron most</Btn>}
      />
      <Grid cols={2}>
        <Panel>
          <Spread>
            <h2>Térkép</h2>
            <Small>
              Sematikus alaptérkép a demóban; élesben OpenStreetMap-csempe
              (Leaflet)
            </Small>
          </Spread>
          <MapSvg highlight={sel} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jármű</TableHead>
                <TableHead>Hely</TableHead>
                <TableHead numeric>km/h</TableHead>
                <TableHead numeric>Üzemanyag</TableHead>
                <TableHead numeric>Km-óra</TableHead>
                <TableHead>Frissítve</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.trucks.map((t) => {
                const x = S.telem[t.id];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <b>{t.id}</b>
                    </TableCell>
                    <TableCell>{x?.place || "—"}</TableCell>
                    <TableCell numeric>{x?.speed || 0}</TableCell>
                    <TableCell numeric>
                      <Pill
                        tone={
                          t.fuel < 25
                            ? "destructive"
                            : t.fuel < 40
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {t.fuel} %
                      </Pill>
                    </TableCell>
                    <TableCell numeric>{fmt(t.km)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {x?.upd || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
        <Stack>
          <Panel>
            <h2>Útvonal-visszajátszás</h2>
            <Sel
              aria-label="Forduló"
              defaultValue={sel ?? ""}
              onCommit={(el) => actions.selectTrip(el.value)}
            >
              <option value="">Válasszon fordulót…</option>
              {S.trips.map((x, i) => (
                <option key={`${x.fid}-${i}`} value={x.fid}>
                  {x.fid} · {x.truck} · {ds(x.date)} · {x.from} → {x.to}
                </option>
              ))}
            </Sel>
            {tr ? (
              <>
                <Table className="mt-2">
                  <TableBody>
                    <TableRow>
                      <TableCell>Megtett út</TableCell>
                      <TableCell numeric>{fmt(tr.km)} km</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        Fogyasztás (rakottan oda, üresen vissza)
                      </TableCell>
                      <TableCell numeric>
                        {fmt(tr.l, 1)} l · {fmt((tr.l / tr.km) * 100, 1)} l/100
                        km
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Tartózkodás a lerakó POI-ján</TableCell>
                      <TableCell numeric>
                        {tr.stopMin} perc → állásidő{" "}
                        {Math.max(0, tr.stopMin - 30)} perc
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Max. sebesség</TableCell>
                      <TableCell numeric>{tr.maxSpeed} km/h</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Alapjárat</TableCell>
                      <TableCell numeric>{tr.idle} perc</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="my-3 text-xs text-muted-foreground">
                  Élesben: GET útvonalak + pozíciók az indulás–érkezés
                  intervallumra; a lerakó POI-ját a rendszer a megrendelés
                  címéből automatikusan létrehozza (iTrack POI API), így az
                  érkezés, távozás és az állásidő kézi rögzítés nélkül kerül a
                  fuvarra és a TIG-re.
                </p>
              </>
            ) : null}
          </Panel>
          <Panel>
            <h2>Tankolás-ellenőrzés</h2>
            <p className="my-3 text-xs text-muted-foreground">
              iTrack detektált tankolás (üzemanyagszint-ugrás) vs. ERP-kiadás /
              üzemanyagkártya.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Idő</TableHead>
                  <TableHead>Jármű</TableHead>
                  <TableHead>Hol</TableHead>
                  <TableHead numeric>iTrack l</TableHead>
                  <TableHead numeric>Számla/kiadás l</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {S.refuels.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.t}
                    </TableCell>
                    <TableCell>{r.truck}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.where}
                    </TableCell>
                    <TableCell numeric>{r.l}</TableCell>
                    <TableCell numeric>{r.erp}</TableCell>
                    <TableCell>
                      {r.ok ? (
                        <Pill tone="success">egyezik</Pill>
                      ) : (
                        <Pill tone="destructive">{r.erp - r.l} l eltérés</Pill>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </Stack>
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Járművenként (szept. 1 – okt. 3.)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jármű</TableHead>
                <TableHead numeric>km</TableHead>
                <TableHead numeric>Üzemóra</TableHead>
                <TableHead numeric>l/100 km</TableHead>
                <TableHead numeric>Tankolt vs. fogyasztott</TableHead>
                <TableHead numeric>Alapjárat</TableHead>
                <TableHead numeric>Gyorshajtás</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.tstats.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{x.id}</TableCell>
                  <TableCell numeric>{fmt(x.km)}</TableCell>
                  <TableCell numeric>{fmt(x.hours)}</TableCell>
                  <TableCell numeric>{fmt(x.cons, 1)}</TableCell>
                  <TableCell numeric>
                    <Pill
                      tone={x.diff / x.fuelL > 0.03 ? "destructive" : "success"}
                    >
                      {x.diff > 0 ? "+" : ""}
                      {fmt(x.diff)} l
                    </Pill>
                  </TableCell>
                  <TableCell numeric>{x.idlePct} %</TableCell>
                  <TableCell numeric>{x.over}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Panel>
          <h2>Sofőrönként</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sofőr</TableHead>
                <TableHead numeric>km</TableHead>
                <TableHead numeric>Vezetés h</TableHead>
                <TableHead numeric>l/100 km</TableHead>
                <TableHead numeric>Gyorshajtás</TableHead>
                <TableHead numeric>Hirtelen fék.</TableHead>
                <TableHead numeric>Eco-pont</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {S.dstats.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{q.DR(x.id).name}</TableCell>
                  <TableCell numeric>{fmt(x.km)}</TableCell>
                  <TableCell numeric>{fmt(x.drive)}</TableCell>
                  <TableCell numeric>{fmt(x.cons, 1)}</TableCell>
                  <TableCell numeric>{x.over}</TableCell>
                  <TableCell numeric>{x.harsh}</TableCell>
                  <TableCell numeric>
                    <Pill
                      tone={
                        x.eco >= 85
                          ? "success"
                          : x.eco < 75
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {x.eco}
                    </Pill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="my-3 text-xs text-muted-foreground">
            Az eco-pont a fuvarszervezés költség-pontszámába és a bérszámfejtés
            eco-prémiumába is bekerül.
          </p>
        </Panel>
      </Grid>
      <Grid cols={2} className="mt-3.5">
        <Panel>
          <h2>Események</h2>
          {S.tEvents.map((e, i) => (
            <Alert
              key={i}
              lvl={
                /Gyors|fék/.test(e.ev)
                  ? "bad"
                  : /POI/.test(e.ev)
                    ? "ok"
                    : "warn"
              }
            >
              <Small className="inline">
                {e.t} · {e.truck} · {q.DR(e.drv).name}
              </Small>
              <div>{e.ev}</div>
            </Alert>
          ))}
          <AiBox who="Pénzügyi elemző · telematika" className="mt-2">
            <p className="mt-1">
              Az SMP-118 tankolt mennyisége 7%-kal több a fogyasztottnál, és
              október 2-án a kártyás tankolásnál 80 l a számla és az iTrack
              közti eltérés. Javaslat: a kártyás tankolás bizonylatának bekérése
              Varga Lászlótól, a kártya napi limitjének 200 l-re csökkentése.
            </p>
          </AiBox>
        </Panel>
        <Panel>
          <h2>Mit ad az iTrack API, mire használjuk</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>iTrack WebService adat</TableHead>
                <TableHead>ERP-felhasználás</TableHead>
                <TableHead>Gyakoriság</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {API_ROWS.map(([a, b, c]) => (
                <TableRow key={a}>
                  <TableCell>{a}</TableCell>
                  <TableCell>{b}</TableCell>
                  <TableCell>{c}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Grid>
    </>
  );
}
