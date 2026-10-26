# Part 3 inventory: lines 900–1400 (plus withSim at 893–897 and the timeline drag handler at 1724–1734, which belong to this range's features)

Global helpers used (defined elsewhere): `TODAY = new Date('2026-10-03T09:00:00')` (line 150, fixed, a Saturday); `distKm(zip)` = first prefix match in `DIST` (`815`→8, `81`→18, `80`→22, `82`→55, `84`→62, `86`→38, `85`→75, `24`→45, `20`→70, `1`→85, `9`→120, `7`→110, `6`→150, `5`→190, `4`→230, `3`→180, `2`→75), default 90 km; `mode(agentId)` = `S.agents.find(id).mode`; `approval(kind,refId,title,reason,ai)` pushes `{id:'J-'+SEQ.AP++, status:'Vár', t:new Date()}` to `S.approvals` (unshift); `nid(k,fmt)` increments `SEQ[k]`; `move(date,pid,depot,qty,type,ref)` pushes a stock move; `log(who,text,ref)` writes the audit log; `toast(msg)`; `render()`; `head(title,sub,right)` page header.
Each extension in this file wraps the previous function (`const _x = x; x = function(){ _x(); ... }`). Layers stack in source order.

## Business rules

### Scenario simulation (`SIM`, `withSim`), lines 893–897, 907–918

- `let SIM = {diesel:560, wage:0, vol:0, blast:4200000, price:0}` (diesel Ft/l net, wage %, volume %, blasting monthly fee in Ft, general price increase %).
- `withSim(fn)`: backs up `S.diesel`, every `S.staff[i].gross`, a deep copy of `S.vol`, every `S.overhead[i][2]`, every `S.products[i].price`, every `S.machines[i].fuel`. Then temporarily sets:
  - `S.diesel = SIM.diesel`
  - each `staff.gross = backup × (1 + SIM.wage/100)`
  - for each key of `S.vol`: `vol[k][1] *= 1+SIM.vol/100` and `vol[k][2] *= 1+SIM.vol/100` (index 0 not scaled)
  - `S.overhead[0][2] = SIM.blast` (the first overhead row is the blasting fee)
  - each `product.price = Math.round(backup × (1+SIM.price/100))`
  - each `machine.fuel *= 1+SIM.vol/100`
  - runs `fn()` and returns its value; `finally` restores everything (S.vol replaced by the backup copy).
- `R.sim` break-even formulas:
  - `fixed = Σ machines.dep + Σ staff.gross × 1.13 + Σ overhead[2]`
  - `avgP = base.revenue / base.totSold`; `varPerT = (base.totalCost − fixed) / base.totSold`; `be = fixed / (avgP − varPerT)` (t/month).
  - Suggested price per product in the scenario: `Math.ceil(b / (1 − S.policy.targetMargin) / 10) × 10` where `b = sc.unit[p.id]`.
- `XC.sim`: `SIM[data-k] = +value; render()`. `X.simreset`: resets SIM to defaults; render.

### Customer profitability (`R.cust`), line 900

- Rows from `custProfit()`, sorted ascending by `margin/rev`.
- Margin % pill: `<.15` → `bad`, `<.25` → `warn`, else `ok`.
- Explanatory formula text (verbatim): "Fedezet = árbevétel − termék-önköltség − fuvar-önköltség − finanszírozási költség (fizetési határidő × 8,5% kamat). Ez mutatja, kinek mennyit ér valójában a kedvezmény és a hosszú fizetési határidő."
- Conditions column: `"{pct(disc)} kedv. · "` if discount, then `"{payDays} nap"`. Overdue: pill `bad` "`{mft(overdue)} · {odDays} nap`", else "—".

### Plan vs actual (`R.plan`), lines 903–906

- Rows: `['Árbevétel', BUDGET.revenue, cm.revenue, +1]` then for stages `kitermeles, toro, rakodas, fuvar, rezsi`: `[stageName(k), BUDGET[k], cm.pools[k], −1]`.
- `d = actual − budget`, `r = d/budget`, `good = sign × d >= 0`. Pill: good → `ok` "kedvező"; not good and `|r| > .1` → `bad` "kedvezőtlen"; else `warn` "kedvezőtlen". Positive d shown with "+".
- AI box "Pénzügyi elemző · eltérés-magyarázat", sentences appended if:
  - `cm.pools.toro > BUDGET.toro`: "A törési költség {mft(diff)}-tal a terv felett van; fő tétel a TOR-01 Sandvik QI440 alkatrész- és külső szervizköltsége ({mft(TOR-01.parts)} + 2,4 M Ft)."
  - `cm.pools.kitermeles > BUDGET.kitermeles`: "A kitermelésben a bérelt dömperek (8,6 M Ft) viszik el a keretet; saját dömper vásárlásának megtérülését érdemes megvizsgálni."
  - `cm.revenue < BUDGET.revenue`: "Az árbevétel {mft(diff)}-tal elmaradt; a földműanyag eladott mennyisége {fmt(cm.soldT.p5)} t volt."
  - none: "Nincs jelentős eltérés."

### Ask-the-ERP (`V.dash` wrap, `X.askq`), lines 925–931

- Box inserted before the first `<div class="aibox" style="margin-top:14px">` in the dashboard.
- `X.askq(d)`: `S.ask.q = d.q; render(); X.ask()` (X.ask defined elsewhere).

### Inquiry file import, lines 942

- On `change` of `#em-file`: reads the file as text, keeps the first 8000 chars. Creates `{id:'INQ-'+(++SEQ.INQ), channel:'E-mail csatolmány', from: #em-from value, name:'', subject: file name, received: new Date(), status:'Új', raw}`; `S.inquiries.unshift`; `processInquiry(inq)`; `sel.inq = inq.id`; render; toast "Beolvasva: {fileName}".

### Receivables aging (`V.billing` wrap), line 957

- Open = docs with `type==='Számla' && !paid && status!=='Sztornó' && due`. `days = (TODAY − due)/864e5`. Buckets: `days<=0` → "Nem lejárt"; `<=7` → "1–7 nap"; `<=15` → "8–15 nap"; else "15 nap felett"; sums `gross`.
- Bar width = `min(100, v / max(...b,1) × 100)%`; class `bad` for buckets 2–3, `warn` for bucket 1.

### Stock cover (`V.stock` wrap #1), line 963

- Per product: `daily = cm.soldT[pid]/30`, `free = stockOf(pid) − reservedOf(pid)`, `days = daily ? free/daily : 999`.
- Bar class `bad` if `days<5`, `warn` if `<10`; width `min(100, days/30×100)%`; label "—" if `days>900`, else "{fmt(days,1)} nap".

### Transfer / survey / tank forms (bindForms wrap #1), lines 979–982

- `trform`: if from==to → toast "A két depó nem lehet azonos." and stop; else `transfer(pid, from, to, +qty)`; on truthy result toast "Átszállítás könyvelve." (`transfer` itself toasts "A forrásdepóban nincs ennyi készlet." and returns false if `t > stockOf(pid,from)`).
- `svform`: `survey(depot, pid, +m3, 'Drónos felmérés')`; toast "Egyezik a könyvi készlettel." if `status==='Egyezik'`, else "Eltérés: helyesbítés jóváhagyásra küldve." (threshold described in UI: 3%).
- `tankform`: `tankCheck(+liters)`; toast "Tartály egyeztetve." (UI says 1% deviation triggers investigation; dot `bad` if `|rel|>.01`).
- All forms: `preventDefault`, run handler, then `render()`.
- `X.wo`: `closeWO(id); render()`.

### Customer portal actions, lines 994–996

- `XC.portal`: `sel.portal = value; render()`. Default `sel.portal = 'c1'`. Nav entry pushed: `NAV[1][1].push(['portal','Vevői portál'])`.
- `X.paccept(id)`: `o = quoteToOrder(id)`; log `('Vevő (portál)', 'Ajánlat elfogadva a portálon', id)`; render; toast "Megrendelés létrejött: {o.id}". (quoteToOrder is wrapped at line 1361 to also `createContract(o)`.)
- `X.reorder(id)`: builds inquiry `{id:'INQ-'+(++SEQ.INQ), channel:'Vevői portál', from:c.email, name:c.name, subject:'Újrarendelés a portálon', received:new Date(), status:'Új', raw}` where raw = `"Újrarendelés ({o.id} alapján)\n" + lines "{fmt(qty)} t {P(pid).aliases[0].toUpperCase()}" + "\nCím: {zip} {city} {addr}\nKért időpont: {iso(TODAY+5d) with '-'→'.'}."`; unshift; `processInquiry`; render; toast "Újrarendelés: {inq.status}".

### Approvals extension (`decide` wrap #1), lines 1003–1007

- If approved and `kind==='inv'`:
  - `refId==='tank'`: `S.parts s1.qty = S.tank[0].dip`; log ('Tulajdonos','Üzemanyag-készlet helyesbítve a mért értékre').
  - else survey: `move(TODAY, sv.pid, sv.depot, sv.diff, 'helyesbítés (felmérés)', sv.id)`; `sv.status='Helyesbítve'`.
- If approved and `kind==='dun'`: client found by `a.title` with prefix "Szállítási zárlat — " removed; `c.hold = true`; log ('Tulajdonos', "Szállítási zárlat elrendelve: {name}").
- Then calls original `decide`.
- `decide` wrap #2 (line 1051): if `kind==='inv'` and `refId` starts with `LAB-`: on approve log ('Tulajdonos', "Minőségi intézkedés jóváhagyva: {product}"); `a.status = ok?'Jóváhagyva':'Elutasítva'`; render; toast "Rögzítve."; does NOT call the original.

### Seed extension #1 (line 1010–1016)

- Pushes quotes:
  - `A-2026-79`: c3 'Balaton-Mélyép Kft.', 8600 Siófok 'Ipari park 4.', date TODAY+4, priceEngine p7 × 400 t, created TODAY−4, valid TODAY+10, status 'Kiküldve'.
  - `A-2026-74`: c2 'Fehérvári Útépítő Kft.', 8000 Székesfehérvár 'Palotai út 9.', date TODAY+2, p4 × 180 t, created TODAY−11, valid TODAY+3, 'Kiküldve'.
- Then `syncPayments(); runFollowups(); runCollections(); runMaintenance();` `survey('CSU-1','p5',2550,'Drónos felmérés (szept. 30.)')`; sorts `S.audit` by `t` desc.

### Production shifts (`RECIPE`, `SITE_OF`, `postShift`), lines 1019–1028

- `S.shifts = []`, `S.lab = []`.
- `RECIPE` yields (share of input tonnage; `veszt` = loss):
  - 'TOR-01 + OSZT-01 · osztályozott frakciók': p4 .276, p9 .118, p10 .171, p11 .335, veszt .10
  - 'TOR-01 · Z 0/22 keverék': p1 .88, p3 .04, veszt .08
  - 'TOR-01 · durva törés': p2 .55, p6 .18, p7 .17, veszt .10
  - 'Csúcsoshegy · osztályozás nélkül': p5 .92, veszt .08
- `SITE_OF`: all three TOR-01 recipes → 'POL'; Csúcsoshegy → 'CSU'.
- `postShift(recipe, inT, hours, who, silent)`:
  - For each non-loss product share: `t = Math.round(inT × share)`; `move(TODAY, pid, P(pid).depot, t, 'gyártás', 'MŰ-{shifts.length+1}')`.
  - Shift record `{id:'MŰ-'+(len+1), date:new Date(TODAY), recipe, site, inT, hours, who, out:[{pid,t}], loss: inT×veszt, tph: inT/hours}` unshifted into `S.shifts`.
  - If recipe starts with 'TOR-01': `TOR-01.next = max(0, next − hours)` (hours until service).
  - Log (who): "Műszak könyvelve: {fmt(inT)} t feladás → {tn(t)} {product name}, …".
  - If `tph < 180` and TOR-01 recipe: log ('AI · Leltár-egyeztető') "Alacsony törőteljesítmény: {fmt(tph)} t/óra (terv 220 t/óra) — a törőpofa kopását ellenőrizni".
  - If not `silent`: `runMaintenance()`. Returns the shift.
- Form `shform`: `postShift(recipe, +t, +h, 'Törőkezelő (ember)')`; toast "Műszak könyvelve, a depók készlete nőtt."

### Lab / quality hold (`labSample`, priceEngine wrap), lines 1029–1034

- `labSample(pid, pass, note)`: record `{id:'LAB-'+(S.lab.length+101), date:new Date(TODAY), pid, pass, note}` unshifted.
  - Fail: `P(pid).qhold = true`; log ('Minőségügy (ember)') "Nem megfelelő vizsgálat: {name} — {note}. A termék zárolva, az árazó és a fuvarszervező nem ad ki belőle."; `approval('inv', LAB-id, 'Minőségi zárolás — {name}', 'Szemeloszlás-vizsgálat nem felel meg: {note}', 'Javaslat: a depó átosztályozása M2 földműanyagba, vagy újratörés; a CE-teljesítménynyilatkozat szerinti szállítás addig szünetel')`.
  - Pass: `P(pid).qhold = false`.
- `priceEngine` wrap: for each line with `qhold`, adds flag `{lvl:'bad', t:'{name}: minőségi zárolás alatt — nem szállítható'}`.
- Form `labform`: `labSample(pid, value==='1', note)`; toast "Rögzítve." if pass, else "Termék zárolva."
- Seed extension #2 (1047–1049): `postShift('TOR-01 + OSZT-01 · osztályozott frakciók', 1760, 8, 'Törőkezelő (ember)', true)`; `postShift('Csúcsoshegy · osztályozás nélkül', 2400, 9, 'Bányamester (ember)', true)`; `labSample(p1..p5, true, 'EN 933-1 szerint megfelel')`; sort audit desc.

### Fleet and driver master data, lines 1055–1106

- `VPARAM` (15 vehicle params: key, label, input type, options, source):
  1. type 'Járműtípus' sel [nyerges billencs, 4 tengelyes billencs, pótkocsis szerelvény] · diszpécser
  2. cap 'Hasznos teherbírás (t)' num · diszpécser
  3. gross 'Megengedett össztömeg (t) / tengely' txt · diszpécser
  4. vol 'Raktér térfogat (m³)' num · diszpécser
  5. tip 'Billentés iránya' sel [hátra, 3 oldalra] · diszpécser
  6. cons 'Átlagfogyasztás (l/100 km)' num · iTrack · automatikus
  7. fuel 'Üzemanyagszint (%)' num · iTrack mérőcsatorna · automatikus
  8. svcKm 'Szervizig hátralévő km' num · iTrack km + munkalap · automatikus
  9. mot 'Műszaki vizsga érvényes' date · diszpécser, figyelt
  10. tacho 'Tachográf-letöltés esedékes (90 nap)' date · tachográf · figyelt
  11. toll 'Útdíj-kategória' sel [J2, J3, J4] · diszpécser
  12. euro 'Környezetvédelmi osztály' sel [EURO V, EURO VI] · diszpécser
  13. permit 'Behajtási engedélyek' txt · diszpécser
  14. pos 'Aktuális pozíció, állapot' ro · iTrack · automatikus
  15. ftkm 'Önköltség (Ft/km)' ro · ERP költségmodell · automatikus
- `DPARAM` (15 driver params):
  1. lic 'Jogosítvány kategória' sel [C, CE] · diszpécser
  2. card 'Sofőrkártya érvényes' date · figyelt
  3. gki 'GKI (95-ös kód) érvényes' date · figyelt
  4. dayDrive 'Napi vezetési idő (9 h, hetente 2× 10 h)' ro · terv + tachográf · automatikus
  5. cont 'Folyamatos vezetés (4,5 h után 45 perc szünet)' ro · automatikus
  6. weekH 'Heti vezetési idő (max. 56 h)' num · tachográf · automatikus
  7. fortH 'Kéthetes vezetési idő (max. 90 h)' num · tachográf · automatikus
  8. restEnd 'Napi pihenő vége (min. 11 h, csökk. 9 h — a terv napok közt ellenőrzi)' txt · tachográf · automatikus
  9. maxDay 'Napi munkaidő-keret (h)' num · diszpécser (Mt.: max. 12 h)
  10. otUsed 'Havi túlóra (felhasznált / keret h)' txt · bérszámfejtés · automatikus
  11. avail 'Elérhetőség' sel [Elérhető, Szabadság, Betegszabadság, Csak délelőtt] · diszpécser
  12. skills 'Járműtípus-jártasság' txt · diszpécser
  13. regions 'Helyismeret (régió)' txt · diszpécser
  14. custPref 'Ügyfél-preferencia / tiltás' txt · diszpécser
  15. eco 'Vezetési stílus (eco-pont, 0–100)' num · iTrack események · automatikus
- `S.trucks` seed (6): RKX-412 MAN TGS 18.480 + Schmitz (nyerges, 25 t, '40 t / 5', 24 m³, hátra, 33.5 l, fuel 68, svcKm 3100, mot 2027-03-14, tacho 2026-11-20, J4, EURO VI, permit 'Budapest P+ (12 t felett)', km 184220, home POL); SMP-118 Volvo FMX 460 + Kässbohrer (nyerges 25, 34.8, fuel 41, svc 9800, mot 2026-12-02, tacho 2026-10-09, EURO VI, Budapest P+, POL); PLG-305 Scania P410 8×4 (4 tengelyes, 19 t, '32 t / 4', 16, 3 oldalra, 31.2, fuel 22, svc 1200, mot 2027-06-30, tacho 2026-12-01, EURO VI, no permit, POL); PLG-411 MAN TGS 35.440 8×4 (4 tengelyes 19, 30.4, fuel 77, svc 14200, mot 2027-01-18, tacho 2026-11-02, Budapest P+, POL); SMP-207 Mercedes Arocs 3346 + Meiller pótkocsi (pótkocsis, 25, '40 t / 6', 26, 3 oldalra, 36.1, fuel 55, svc 6400, mot 2026-10-21, tacho 2026-10-28, no permit, home CSU); RKX-530 DAF XF 480 + Wielton (nyerges 25, hátra, 35.6, fuel 63, svc 22000, mot 2027-02-09, tacho 2026-12-15, EURO V, no permit, POL). All toll J4.
- Machines pushed for cost model: PLG-411 (h120, dep 900000, fuel 3900, parts 150000, next 14200, svcEvery 30000, km 8200, toll 360000), SMP-207 (110, 1000000, 3700, 210000, 6400, 30000, 7400, 330000), RKX-530 (95, 500000, 3400, 640000, 22000, 30000, 6900, 300000); all stage 'fuvar'.
- `S.drivers` seed (7) – fields id, name, lic, card, gki, weekH, fortH, restEnd, maxDay, ot, otCap, avail, skills, regions, custPref, eco, rate (Ft/h), perTrip, home:
  - D1 Szabó Péter, CE, 2027-05-31, 2027-11-30, 31.5, 66, 05:00, 12, 14/24, Elérhető, 'nyerges billencs, 4 tengelyes billencs', 'Fejér, Budapest', 'V-Híd: előnyben', 88, 2650, 2400, Polgárdi
  - D2 Varga László, CE, 2026-12-15, GKI 2026-10-20, 44, 84, 05:30, 12, 21/24, Elérhető, 'nyerges billencs, pótkocsis szerelvény', 'Fejér, Veszprém', '', 74, 2600, 2400, Székesfehérvár
  - D3 Németh Gábor, C, 2028-02-01, 2027-04-30, 28, 55, 05:00, 12, 6/24, Elérhető, '4 tengelyes billencs', 'Fejér, Somogy', 'Balaton-Mélyép: helyismeret', 91, 2500, 2200, Lepsény
  - D4 Kiss Attila, CE, 2027-08-10, 2028-01-31, 36, 71, 06:00, 12, 10/24, Elérhető, all three types, 'Fejér, Budapest, Pest', '', 82, 2650, 2400, Kisláng
  - D5 Tóth Zoltán, CE, 2027-01-05, 2027-09-15, 12, 40, 05:00, 12, 2/24, Szabadság, 'nyerges billencs', 'Fejér', '', 79, 2550, 2300, Polgárdi
  - D6 Horváth Bence, C, 2029-03-20, 2029-03-20, 22, 47, 05:00, 12, 4/24, Elérhető, '4 tengelyes billencs', 'Fejér, Veszprém', 'Fehérvári Útépítő: előnyben', 69, 2400, 2200, Füle
  - D7 Molnár Csaba, CE, 2027-10-01, 2027-06-30, 40, 80, 05:00, maxDay 10, 23/24, 'Csak délelőtt', 'nyerges billencs, 4 tengelyes billencs', 'Fejér, Somogy', 'Kovács János: tiltva (panasz)', 85, 2600, 2400, Polgárdi
- `S.leave`: D5 2026-10-01..2026-10-09 'Szabadság'; D3 2026-10-08..2026-10-08 'Orvosi vizsgálat'.

### Address rules (`ADDRRULE`, `addrRules`), lines 1108–1109

- Rules (regex `m`, tested against the string `"{zip} {city} {addr}"` OR against `zip` alone):
  1. `/budapest|^1\d{3}$/i` → zone 'Budapest', `needPermit:true`, `euro:'EURO VI'`, note "Budapest: 12 t felett behajtási engedély (P+), EURO VI"
  2. `/siófok|8600/i` → zone 'Siófok belterület', `maxGross:32`, note "Siófok, Fő utca: 32 t össztömeg-korlátozás (csak 4 tengelyes)"
  3. `/seregélyesi/i` → zone 'Székesfehérvár', `tip:'3 oldalra'`, note "Seregélyesi út: szűk lerakó, oldalra billentés szükséges"
- `addrRules(o)` returns all matching rules.

### Helpers, lines 1110–1122

- `isLeave(d, date)`: leave entry with `l.d===d.id` and `from <= iso(date) <= to` (ISO string comparison).
- `DR(id)`, `TR(id)`: lookups in drivers / trucks.
- `truckFtKm(t) = Math.round(costModel().ftPerKm × (t.cons/34) × (t.euro==='EURO V' ? 1.06 : 1))`.
- `tripTimes(f)`: `km = f.km || distKm(order.zip || '8000')`; `drive = km/52 + km/58` (loaded out at 52 km/h, empty back at 58 km/h); `dur = 0.33 + 0.25 + drive` (loading 20 min, unloading 15 min). Returns `{km, drive, dur}` in hours.
- `dayTrips(date, filter)`: transports with `status !== 'Törölve'`, same ISO date, optional filter.
- `mondayOf(d)`: Monday of that week at 09:00 (`k = (getDay()+6)%7`).
- `weekDrive(d, date, exclude)`: hours driven in the week before `date`:
  - if the week is TODAY's week, base = `d.weekH`; if later week, base 0; (earlier week: base 0 as well, default).
  - adds `driverDay(d.id, x, exclude).drive` for each day x from Monday up to (not including) `date` with `iso(x) >= iso(TODAY)`.
- `ext10Count(d, date, exclude)`: number of days from Monday before `date` with planned drive > 9 h.
- `driverDay(dId, date, exclude)`: over that driver's trips that day (excluding id `exclude`): `drive = Σ f.drive`, `work = Σ f.dur`, `end = max(start||6 + dur)` with floor 6, `n = count`.
- `truckDay(tId, date, exclude)`: `work`, `end` (as above), `n`, `km = Σ f.km × 2`.
- `fmtH(h)`: "HH:MM" (minutes rounded; 60 → 00 without hour carry).

### Suggestion engine (`evaluate(f, t, d)`), lines 1124–1154

Inputs: trip f, truck t, driver d. `date = f.date`, `rules = addrRules(order)`, `tt = tripTimes(f)`.
Hard constraints (each pushes a message; any → not ok):

- `t.cap < f.planned` → "teherbírás {cap} t < {fmt(planned,1)} t"
- per rule: `maxGross && parseFloat(t.gross) > maxGross` → "{zone}: max. {maxGross} t össztömeg"; `needPermit && !/budapest/i.test(t.permit)` → "{zone}: nincs behajtási engedély"; `euro && t.euro !== euro` → "{zone}: {euro} szükséges"; `tip && t.tip !== tip` → "lerakó: {tip} billentés szükséges"
- `t.mot < iso(date)` → "lejárt műszaki vizsga"
- open work order (`status!=='Lezárva'`) for machine == truck id with due date == date → "szervizen ezen a napon"
- `date.getDay()===0` → "vasárnapi kamionstop (7,5 t felett)"
- `d.lic==='C' && t.type !== '4 tengelyes billencs'` → "{name}: C kategória, CE kell"
- on leave → "{name}: {kind lowercased}"; `avail==='Betegszabadság'` → "{name}: betegszabadság"
- `d.card < iso(date)` → "lejárt sofőrkártya"; `d.gki < iso(date)` → "lejárt GKI"
- `custPref` contains "tiltva" and starts with the first word of `f.clientName` → "{name}: ügyfél-tiltás"
- Start time: `start = max(f.prefStart||6, driverDay.end, truckDay.end)` (excluding f itself). `dur = tt.dur`.
- Continuous driving: if `dd.drive + tt.drive > 4.5` and `dd.drive <= 4.5` → `dur += 0.75`, soft "45 perces szünet beiktatva (4,5 h vezetés)".
- `dayLimit = avail==='Csak délelőtt' ? 13 : 6 + d.maxDay` (clock hour).
- Daily rest: `prev = driverDay(previous day)`; `restH = prev.n ? start + 24 − prev.end : 99`. `<9` → hard "napi pihenő {restH} h < 9 h (előző nap {fmtH(prev.end)}-ig dolgozott)"; `<11` → soft "csökkentett napi pihenő ({restH} h)".
- Daily driving `dTot = dd.drive + tt.drive`: `>10` → hard "napi vezetési idő túllépés ({dTot} h > 10 h)"; `>9`: if `ext10Count >= 2` → hard "napi vezetési idő {dTot} h — a heti 2 db 10 órás hosszabbítás elfogyott", else soft "10 órás hosszabbítás (heti 2-ből)".
- Weekly: `wk = weekDrive(d,date,f.id) + dTot`. `start+dur > dayLimit` → hard "munkaidő-keret: {fmtH(start+dur)} > {fmtH(dayLimit)}". `wk > 56` → hard "heti vezetési idő {wk} h > 56 h".
- Fortnight: `prevWk` = `d.fortH − d.weekH` if date's week is TODAY's week; if date's week is the next week, `weekDrive(d, Sunday before) + driverDay(Sunday before).drive`; else 0. `prevWk + wk > 90` → hard "kéthetes vezetési idő {x} h > 90 h".
  Cost (Ft, lower is better):
- `cost += tt.km × 2 × truckFtKm(t)`
- not practiced on type (`!d.skills.includes(t.type)`): soft "nem gyakorlott {type} típuson", +6000
- empty capacity `empty = (cap − planned)/cap > 0.1`: `+ empty × km × 2 × ftkm × 0.8`, soft "kihasználtság {pct(planned/cap)}"
- overtime: if `dd.work + dur > 8`: `ot = min(dur, dd.work+dur−8)`, `+ ot × d.rate × 0.5`, soft "{ot} h túlóra"; if `d.ot + ot > d.otCap` +20000 and soft "havi túlóra-keret közel"
- `t.fuel < 25`: +4000, soft "alacsony üzemanyagszint — tankolás 20 perc"
- `t.home !== product.depot.slice(0,3)`: `+ 18 × 2 × ftkm`, soft "állás a másik bányában — 18 km üresjárat"
- custPref matches /előnyben|helyismeret/ and starts with client's first word: −5000, soft "ügyfél-preferencia ✓"
- eco: `+ (90 − d.eco) × 120` (can be negative)
- early/late: `+ max(0, start−7) × 2200`; if `start+dur > 16`: `+ (start+dur−16) × 3000`
- load balance: `avgWork` = mean of `driverDay(x,date).work` over all drivers; `+ max(0, dd.work − avgWork) × 900`
- Returns `{t, d, ok: !hard.length, hard, soft, cost: round, start, dur, drive, km, end: start+dur}`.

### `suggest(f, n=3)`, line 1156

- Evaluates every truck × driver pair. `ok` = valid ones sorted by cost ascending. `best = ok[0].cost || 0`. `score = max(1, round(100 − (cost−best)/max(best,1) × 100))`.
- Returns `{top: ok.slice(0,n), rejected: invalid list, okCount, total}`.

### `assign(f, tId, dId, by, startOverride)`, line 1158

- Evaluates the pair; sets `f.truck, f.driverId, f.driver (name), f.start (override ?? ev.start), f.dur, f.drive, f.km, f.warn = ev.hard copy`.
- If trip has an EKÁER number and the truck changed from a non-null old truck: `ekaerModify(f, 'rendszám → {newId}')`.
- If `by`: log (by) "{f.id}: {truck} · {driver} · {fmtH(start)}–{fmtH(start+dur)}" plus " (felülbírálva: {hard joined by '; '})" when hard violations exist. Returns ev. Assignment is applied even when hard rules fail.

### `autoAssignDay(date, onlyUnaccepted=true, move=false, depth=0)`, lines 1162–1166

- Trips that day with status 'Javasolt' (and 'Tervezett' too if `!onlyUnaccepted`), sorted by `prefStart||6` ascending then `planned` descending.
- Clears `driverId`, `truck`, `start` on all of them, then for each: `suggest(f,1)`; if a valid top exists → `assign` (no log) and `f.warn=[]`, ok++.
- Else if `move && depth < 4`: move to next day (skip Sunday → +1 more), `prefStart=6`, add to moved, fail++.
- Else: `f.warn = ['nincs szabályos kiosztás — áttenni másik napra']`, fail++.
- If moved: log ('AI · Fuvarszervező') "{n} forduló kapacitás hiányában a következő munkanapra téve"; recursively `autoAssignDay(newDate 09:00, true, true, depth+1)` for each distinct new date.
- Returns `{ok, fail, moved}`.

### `acceptTrip(f, by)` (base, line 1167; wrapped at 1362)

- Base: false if no truck or driver. `status='Tervezett'`; if `ekaer.required && !ekaer.number` → `ekaerSubmit(f.id, true)`; log (by || 'Diszpécser (ember)') "Fuvar elfogadva, a sofőr appjába elküldve"; true.
- Wrap: contract gate: if `S.policy.requireContract` (set true at 1360) and a contract exists for the order with status ≠ 'Iktatva' and `!f._cOvr` → `f.warn` = existing warnings without any containing "szerződés" plus 'a szerződés még nincs aláírva'; returns false. Orders with no contract pass.

### `planTransports(oid)` (replacement), lines 1169–1175

- `maxCap = any rule with maxGross ? 19 : 25`. Start day = order date; Sunday → Monday.
- Per order line: `rest = qty − planned − delivered`. While `rest > 0.01`: `t = min(maxCap, rest)`; if `perDay >= (maxCap<25 ? 8 : 10)` advance one day (skip Sunday), reset perDay.
- Trip: `{id: nid('F', n=>'F-2026-'+n), order, clientId, clientName, pid, planned:t, truck:null, driver:'', driverId:null, date, prefStart: 6 + perDay×0.4, status:'Javasolt', net:null, depot:P(pid).depot, ekaer: ekaerCheck(o,pid,t), km: distKm(o.zip)}`, unshifted; `o.planned[pid] += t`.
- Then for each distinct date of this order's 'Javasolt' trips: `autoAssignDay(date 09:00, true, true)`.
- `o.status='Ütemezve'`; log ('AI · Fuvarszervező') "{made} forduló, {days} napra; kiosztási javaslat kész, diszpécseri elfogadásra vár". Returns made. Trigger: `[data-plan]` click → toast "{n} forduló ütemezve." (line 766).

### Dispatcher actions, lines 1250–1270 (+ 1363 replacement of X.dacc)

- `X.dtab`: `DISP.tab = k`.
- `X.dday`: `DISP.date += n days`, `DISP.sel = null`. `XC.dday`: `DISP.date = new Date(value+'T09:00')`, sel null.
- `X.dsel`: `DISP.sel = id`.
- `X.dgoto`: `DISP.date = date 09:00`, `DISP.tab='day'`, `DISP.sel = id` if given.
- `X.dweek`: `DISP.week += n days` (±7).
- `X.dpick`: `assign(f, t, d, 'Diszpécser (ember)')`; `f.warn=[]`; toast "Kiosztva. Elfogadás után megy a sofőrnek."
- `X.dacc` (final version, line 1363):
  1. Contract exists for order, status ≠ 'Iktatva', `!f._cOvr` → set `f._cOvr=true`, append 'a szerződés még nincs aláírva' to warn, render, toast "A szerződés nincs aláírva. Újabb kattintás: elfogadás kivételként (naplózva)." Stop.
  2. Non-contract warnings exist and `!f._ovr` → `f._ovr=true`; toast "Ütközés van. Kattintson újra az elfogadáshoz (felülbírálás, naplózva)." Stop.
  3. `acceptTrip(f)`; render; toast "Elfogadva, EKÁER és sofőr app frissítve." (toast shows even if the wrapped acceptTrip returned false.)
- `X.daccall`: trips on `DISP.date` with status 'Javasolt' and no warnings → `acceptTrip(f,'Diszpécser (ember)')` each; toast "{n} fuvar elfogadva." (n = candidates, including any refused by the contract gate).
- `X.dauto`: `autoAssignDay(DISP.date)` (no moving); log ('AI · Fuvarszervező') "Napi kiosztás újraszámolva: {ok} kiosztva, {fail} nem osztható"; toast "{ok} fuvar kiosztva" + ", {fail} nem osztható" if fail + ".".
- `X.dsave`: reads `dm-date`, `dm-start` (HH:MM), `dm-q`. If quantity changed: `o.planned[pid] += q − planned`; `f.planned = q`; `f.ekaer = ekaerCheck(o,pid,q)` merged with previous `number`, `status` (kept if numbered, else new check's status), `job`; if numbered → `ekaerModify(f, 'mennyiség {tn(q)}')`. Then `f.date = new date`; `assign(f, dm-t, dm-d, 'Diszpécser (ember)', hh+mm/60)`; `DISP.date = new date`; toast "Mentve, de szabályt sért: {first hard}" or "Mentve."
- `XC.drows`: `DISP.rows = value` ('truck' | 'driver').
- `XC.lt` (list truck select): `assign(f, value, f.driverId || S.drivers[0].id, 'Diszpécser (ember)')`; toast "Szabálysértés: {hard[0]}" or "Jármű módosítva."
- `XC.ld` (list driver select): `assign(f, f.truck || S.trucks[0].id, value, ...)`; toast "Szabálysértés: …" or "Sofőr módosítva."
- `XC.res` (resource param edit): sets `o[k] = number ? +value : value` on truck (`kind t`) or driver (`kind d`); log ('Diszpécser (ember)') "{id or name}: {k} = {value}"; re-evaluates all 'Javasolt'/'Tervezett' trips that have truck+driver: `f.warn = evaluate(...).hard`; toast "Mentve; a tervek újraellenőrizve."
- `X.dleave`: toggles a one-day leave: if a leave entry covering that date exists for the driver, removes that whole entry (even multi-day); else pushes `{d, from:date, to:date, kind:'Szabadság'}`. Re-evaluates that driver's trips that day with status ≠ 'Lezárva' (`f.warn = hard`). Log "{name}: szabadság törölve {date}" or "{name}: szabadság {date}". Toast "{n} fuvar érintett — futtassa újra a kiosztást." or "Mentve."
- `X.addtruck`: pushes `{id:'ÚJ-'+(len+1), name:'Új jármű', type:'4 tengelyes billencs', cap:19, gross:'32 t / 4', vol:16, tip:'hátra', cons:32, fuel:50, svcKm:30000, mot: TODAY+365, tacho: TODAY+90, toll:'J4', euro:'EURO VI', permit:'', km:0, home:'POL'}` (no machine entry, no tare). No toast.
- `X.adddriver`: pushes `{id:'D'+(len+1), name:'Új sofőr {n}', lic:'CE', card:TODAY+900, gki:TODAY+900, weekH:0, fortH:0, restEnd:'05:00', maxDay:12, ot:0, otCap:24, avail:'Elérhető', skills:'nyerges billencs', regions:'Fejér', custPref:'', eco:80, rate:2500, perTrip:2300, home:'Polgárdi'}`. No toast.
- `telemPos(t)`: `S.telem[t.id]` → "{place} · {speed} km/h", else "—".
- `X.itsync`: `itrackSync()` (line 1468); toast "iTrack: pozíció, km, üzemanyagszint, fogyasztás frissítve."
- `[data-cancel]` (handler line 753): if EKÁER number → `ekaerCancel(f)`; `status='Törölve'`; `o.planned[pid] = max(0, planned − f.planned)`; log 'Fuvar törölve, a mennyiség újra ütemezhető'; toast "Fuvar törölve, EKÁER-bejelentés visszavonva."
- Timeline drag (bindTimeline, 1725–1733, wired via bindForms wrap): pointerdown on a trip `<g data-id>` (not 'Lezárva'); moves >5 px (|dx|+|dy|) count as drag, block follows via `transform`. On pointerup: `row = floor((y − H0)/rh)` clamped to rows; `hour = round(((start||6) + dx/((W−lw−10)/14)) × 4)/4` (15-min snap), clamped to [5, 18]. In truck mode: new truck = row key, driver kept (or first driver); in driver mode: new driver = row key, truck kept (or first truck). `assign(f, tId, dId, 'Diszpécser (húzással)', hour)`; `DISP.sel = f.id`; toast "Áthelyezve, de szabályt sért: {hard[0]}" or "Áthelyezve: {tId} · {fmtH(start)}". A click without movement falls through to `data-x="dsel"`.

### Scale-up data (IIFE, lines 1274–1299), applied at load

- 14 extra trucks MPK-101..MPK-114 (models/types/cap/gross/vol/tip/cons per list in source: 4 tengelyes = 19 t '32 t / 4' 16 m³ '3 oldalra'; nyerges = 25 t '40 t / 5' 24 m³ 'hátra'; MPK-108 pótkocsis 25 t '40 t / 6' 26 m³ '3 oldalra'). Per index i (0-based): `fuel = 30 + (i×17)%60`, `svcKm = 4000 + (i×3700)%26000`, `mot = TODAY + 40 + i×23 d`, `tacho = TODAY + 12 + i×6 d`, toll J4, `euro = i%5===4 ? 'EURO V' : 'EURO VI'`, `permit = i%3===0 ? 'Budapest P+ (12 t felett)' : ''`, `km = 150000 + i×21000`, `home = i%4===3 ? 'CSU' : 'POL'`.
  - Matching machines: `h = 150 + (i%5)×8`, `dep = 850000 + (i%4)×90000`, `fuel = 4600 + (i%5)×300`, `parts = 260000 + (i%3)×80000`, `next = svcKm formula`, `svcEvery 30000`, `km = 9200 + (i%6)×700`, `toll 420000`, stage 'fuvar'.
- Tare per truck type: 4 tengelyes 12.6 t, pótkocsis 14.4 t, else 15.2 t.
- 13 extra drivers D8..D20 (names: Bognár Ferenc, Fekete István, Lakatos Gyula, Pintér Sándor, Balogh Norbert, Juhász Tibor, Mészáros Dániel, Simon Attila, Farkas Róbert, Papp Krisztián, Takács József, Szűcs Márk, Oláh Gábor). `lic = i%4===2 ? 'C' : 'CE'`; `card = TODAY + 200 + i×45 d`; `gki = TODAY + 90 + i×60 d`; `weekH = 14 + (i×7)%30`; `fortH = 40 + (i×9)%40`; `ot = (i×5)%20`; otCap 24; maxDay 12; restEnd 05:00; `avail = i===6 ? 'Szabadság' : 'Elérhető'`; skills C → '4 tengelyes billencs', else all three; `regions = i odd ? 'Fejér, Veszprém' : 'Fejér, Budapest'`; `eco = 72 + (i×5)%22`; `rate = 2450 + (i%4)×60`; perTrip 2300; home cycles Polgárdi, Székesfehérvár, Lepsény, Füle, Kisláng, Enying.
- Products: p4 renamed '0/4 zúzalék (kőliszt-homok)'; added p9 '4/11 zúzalék' (vtsz '2517 10', price 8200, factor 1.6, depot POL-2, min 300, own, alias '4/11'), p10 '11/22 zúzalék' (8600, 1.5, POL-2, 300, '11/22'), p11 '22/63 zúzottkő' (6800, 1.1, POL-2, min 500, '22/63').
- Volumes: each existing `S.vol[k] = [round(v0×1.2), round(v1×1.45), round(v2×1.45)]`; add p9 [900,2600,2450], p10 [700,1900,1800], p11 [1400,4300,4100].
- `S.pnl.rev` and `.cost` × 1.62 (1 decimal).
- `S.staff` replaced (12 rows: name, stage, gross Ft/month, hours): Dózerkezelő kitermeles 690000/176; Rakodógép-kezelő, törő (2 fő) toro 1290000/340; Rakodógép-kezelő, rakodás (5 fő) rakodas 3250000/880; Gépkocsivezető (20 fő) fuvar 12600000/3700; Szerelő (3 fő) rezsi 2160000/504; Fuvarszervező 720000/168; Irodavezető 780000/168; EKÁER/admin (2 fő) 1040000/336; Könyvelő 690000/168; Vevőkezelés, bányai admin (2 fő) 1040000/336; Hulladéklerakó-kezelő 480000/168; Menedzsment 1300000/168 (all rezsi except first four).
- Overhead rows matching /dömper|kotró/i removed. Every `BUDGET[k] × 1.55` rounded.
- Spare part compatibility `p.compat`: s1 ['minden gép és jármű'], s2 ['tehergépkocsik', RAK-01..03], s3 [RAK-01..03, DOZ-01, TOR-01], s4/s5 all non-fuvar machines, s6 ['TOR-01'], s7 ['OSZT-01'], s8 ['DOZ-01'], s9 RAK; default all non-fuvar machines.

### Document registry (`sha256`, `fileDoc`), lines 1302–1304

- `S.registry = []`, `SEQ.IK = 0`.
- `sha256(s)`: async WebCrypto SHA-256 hex; on failure fallback `h = (h×31 + charCode)|0` over chars, returns `'fnv' + abs(h).toString(16)`.
- `fileDoc(type, ref, title, content, by)`: `no = 'IK-2026-' + 4-digit zero-padded ++SEQ.IK`; record `{no, date:new Date(), type, ref, title, by, hash:'…'}` unshifted; async hash of `content + '|' + no` fills `hash`, re-renders if `route` is 'contracts' or 'tig'; log ('Iktató') "{type} iktatva: {no} — {title}" ref; returns `no`.

### Contracts, lines 1306–1364

- `S.ctemplate`: contract text template (Hungarian, verbatim in source lines 1306–1342) titled "ADÁSVÉTELI ÉS SZÁLLÍTÁSI SZERZŐDÉS", 10 sections: 1. Felek, 2. A szerződés tárgya, 3. Mennyiség és minőség (MSZ EN 13242 / 12620, weighbridge net mass, ±5% tolerance), 4. Ár (27% áfa, fixed unit prices), 5. Szállítás és átvétel (30 min free wait per trip, then 18 000 Ft/óra + áfa standing fee), 6. Teljesítésigazolás (accept or reject within 3 working days, otherwise deemed accepted), 7. Fizetés (Ptk. 6:155. § late interest, 40 EUR collection cost; >15 days late → deliveries may be suspended), 8. Tulajdonjog-fenntartás, 9. Elektronikus aláírás (hash-registered), 10. Záró rendelkezések; "Kelt: Polgárdi, {{datum}}".
  - Placeholders: szerzodesszam, ajanlatszam, megrendelesszam, vevo_nev, vevo_cim, vevo_adoszam, szallitasi_cim, tetelek, fuvar, osszeg_netto, osszeg_brutto, teljesitesi_idoszak, fizetesi_hatarido, datum.
- `contractText(c)`: map: szerzodesszam=c.id; ajanlatszam=o.quote; megrendelesszam=o.id; vevo_nev=o.clientName; vevo_cim = "{cl.zip} {cl.city}" if zip else ''; vevo_adoszam = cl.tax || 'magánszemély'; szallitasi_cim = "{o.zip} {o.city} {o.addr}" trimmed; tetelek = lines " – {name}: {tn(qty)} × {ft(unitNet)}/t = {ft(net)}"; fuvar = "{ft(freightPerT)}/t, összesen {ft(freightNet)}"; osszeg_netto/brutto = ft(pr.net)/ft(pr.gross); teljesitesi_idoszak = "{ds(o.date)} – {ds(o.date+21 d)}"; fizetesi_hatarido = cl.end ? 'előre utalás vagy készpénz rakodáskor' : 'számla kelte + {payDays} nap, átutalással'; datum = ds(c.created). Unknown keys left as `{{key}}`. Missing quote → empty pr defaults.
- `createContract(o, silent)`: no-op if a contract for the order exists. `{id:'SZE-2026-'+3-digit ++SEQ.SZE, order, clientId, clientName, created:new Date(TODAY), template:S.ctemplate, status:'Piszkozat', history:[]}` unshifted; history ['AI · Szerződéskészítő','Szerződés a sablonból, a megrendelés adataival'].
  - If `mode('contract')==='auto'`: `status='Kiküldve'`, `sent=new Date()`, history ['Rendszer','E-mailben kiküldve, aláírási link a vevői portálon'], log "Szerződés kiküldve aláírásra: {id}".
  - Else: `approval('contract', c.id, 'Szerződés — {clientName}', 'A házirend szerint a szerződést ember küldi ki', 'Ellenőrizze a tételeket, majd hagyja jóvá a kiküldést')`. Returns c (undefined if already existed). `silent` unused.
- `signContract(c, how, signer, sig)`: status 'Aláírva (elektronikusan)' if how==='e' else 'Aláírt példány feltöltve'; sets signed, signer, sig, how; history ["Vevő ({signer})", 'Elektronikusan aláírva a portálon' | 'Aláírt, lefotózott példány feltöltve']; `c.ik = fileDoc('Szerződés', c.id, '{id} · {clientName}', contractText(c)+(sig||''), how==='e'?'Vevői portál':'Feltöltés')`; `status='Iktatva'`; history ['Iktató','Iktatószám: {ik}'].
- Agents added: `contract` 'Szerződéskészítő' (mode auto, "Elfogadott ajánlatból sablon alapján szerződést készít, kiküldi, figyeli az aláírást, iktat."), `tig` 'Teljesítésigazoló' (mode auto, "A teljesített megrendelésből vagy elszámolási időszakból TIG-et készít, aláírásra küldi, elfogadás után indítja a számlát.").
- PHASES inserted: at index 3 ['Szerződés','Szerződéskészítő','sablonból szerződés, kiküldés, aláírás-figyelés, iktatás','szerződés nélküli első fuvar (házirend)']; at 9 ['Teljesítésigazolás','Teljesítésigazoló','TIG a teljesített fordulókból, e-aláírás vagy fotó, iktatás','vevői kifogás'].
- `S.policy.requireContract = true`. `quoteToOrder` wrapped: creates contract for the new order.
- Contract signing UI handlers outside range: `X.pcsign` (1459) requires checkbox `cs-ok-{id}` ("Jelölje be a nyilatkozatot.") and a signature ("Az aláírás hiányzik.") then `signContract(c,'e',name,sig)` → "Szerződés aláírva és iktatva."; photo upload `data-photo="contract"` → `signContract(c,'photo','aláírt papírpéldány',img)` → "Aláírt szerződés feltöltve és iktatva."

### TIG (completion certificate), lines 1367–1380

- `S.tigs = []`, `SEQ.TIG = 0`.
- `createTIG(oid, why)`: trips of the order with status 'Lezárva' and no `tig`; none → null. Record `{id:'TIG-2026-'+3-digit, order, clientId, clientName, from: min trip date, to: max trip date, trips: ids, created: new Date(), status:'Aláírásra vár', history:[[now,'AI · Teljesítésigazoló', why || 'TIG a lezárt fordulókból']]}`; marks each trip `f.tig = id`; unshift; log "{id} elkészült ({n} forduló), aláírásra elküldve a vevőnek".
- `tigLines(t)`: rows per trip `{f, dn: delivery note doc, price: line.unitNet, net: f.net × unitNet}`; `tons = Σ net`; `prod = Σ row.net`; `fr = tons × (o.freightPerT || 0)`; waiting `wmin = Σ f.wait`, `extra = max(0, wmin − trips×30)` minutes; `wait = extra/60 × 18000` Ft; `total = prod + fr + wait`.
- `acceptTIG(t, how, signer, sig)`: status 'Elfogadva (aláírt fotó)' if how==='photo', else 'Elfogadva (e-aláírás)' (also for 'device'); sets signer, sig, signedAt; history [now, signer, 'Aláírt TIG fotója feltöltve' | 'Aláírva a sofőr tabletjén átvételkor' (device) | 'Elektronikusan elfogadva a portálon']; `t.ik = fileDoc('Teljesítésigazolás', t.id, '{id} · {clientName}', JSON.stringify(trips)+(sig||''), signer)`; if `mode('billing') !== 'off'` → `invoiceOrder(t.order)` and history ['AI · Számlázó','Számla a TIG alapján'].
- `onOrderComplete(o)`: `createTIG(o.id, 'A megrendelés teljesült — TIG az összes fordulóról')`. Called at line 403 when every order line has `delivered >= qty × 0.98` (order status → 'Teljesítve').
- `tigOk(f)`: trip's TIG exists and status starts with 'Elfogadva'. `_inv = invoiceOrder` saved (used later).

### Driver app helpers, lines 1383–1392

- `DRV = {id:'D1'}`.
- `sigPad(id, label)`: canvas 520×150 class `sig` + "Törlés" button (`data-x="sigclear"`).
- `X.sigclear`: clears canvas, `dataset.dirty = ''`.
- `bindSig()` (called from a later bindForms wrap, line 1693): binds once per canvas; line width 2.2, round cap, stroke = body text color; pointerdown starts path (pointer capture), pointermove draws and sets `dirty='1'`, pointerup/cancel stops. Coordinates scaled from CSS to canvas size.
- `sigData(id)`: PNG data URL if canvas is dirty, else null.
- `readPhoto(input, cb)`: reads first file as data URL, downsizes so the longest side ≤ 900 px (`k = min(1, 900/max(w,h))`), re-encodes JPEG quality 0.75, `cb(dataUrl, fileName)`; on image decode error passes the raw data URL.

## Screens / panels in range

### Riportok és árazás (`V.reports`), line 921

- Header: "Riportok és árazás" / "Minden riport ugyanabból a költségmodellből: amit itt lát, azzal számol az árazó is."
- Tabs (role=tablist, `data-rep`, aria-selected on current `sub.reports`): Eredmény (pnl), Terv–tény (plan), Cash-flow (cash), Önköltség és árazás (cost), Mi lenne, ha (sim), Vevők (cust), Munkaerő (labor), Gépköltség (mach). Body = `R[tab]()`.
- **Vevők** panel "Vevői jövedelmezőség · szeptember": table columns Vevő, Tonna, Árbevétel, Termék-önktg., Fuvar-önktg., Finansz., Fedezet, %, Feltételek, Lejárt.
- **Terv–tény** panel "Terv–tény · szeptember": columns Sor, Terv, Tény, Eltérés, %, Értékelés; AI box as above.
- **Mi lenne, ha** (two-column grid):
  - Panel "Mi lenne, ha…": range sliders, label "{label}: **{value}{unit}**": "Gázolaj nettó ár" 450–750 step 5 " Ft/l"; "Béremelés" 0–20 step 1 " %"; "Eladott és termelt mennyiség" −30–30 step 5 " %"; "Robbantás havi díja" 3 000 000–6 000 000 step 100 000 " Ft"; "Általános áremelés" 0–20 step 1 " %". Each slider `data-xc="sim"` fires on change → re-render. Button "Alaphelyzet" (`simreset`).
  - Panel "Hatás": rows Üzemi eredmény, Árrés, Fuvar Ft/km with base vs bold scenario. Line: "Fedezeti pont (jelenlegi struktúrával): **{be} t/hó** eladás · fix költség {fixed}/hó, változó {varPerT}/t."
  - Panel "Önköltség és javasolt ár a forgatókönyvben": columns Termék, Önköltség most, Forgatókönyv, Változás, Ár célárréssel.

### Irányítópult addition "Kérdezze az ERP-t" (lines 926–930)

- Title + pill "élő Claude, az ERP adataival".
- If `SAMPLE` (Claude available): input `#ask-q` (value S.ask.q, aria-label "Kérdés"), button "Kérdezek" (`data-x="ask"`, disabled and label "Gondolkodik…" while busy). Six preset buttons (`data-x="askq"`): "Melyik vevő hozza a legkevesebb fedezetet?", "Mennyivel emeljem a földműanyag árát?", "Mikor lesz szűk a pénz, és mit halasszak?", "Melyik gép a legdrágább tonnára vetítve?", "Mi történt ma?", "Miért termeltünk ma kevesebbet?". Output div `#ask-out` (pre-wrap) shows "Gondolkodik…" while busy with no answer, else `S.ask.a`.
- Else: text "Ebben a nézetben a Claude-hívás nem érhető el. A megosztott, claude.ai-ban megnyitott oldalon a tulajdonos szabad szöveges kérdést tehet fel; a modell az ERP eredmény-, önköltség-, készlet-, cash-flow-, gép- és vevőadatait eszközként éri el."

### Ajánlatkérés (inbox) additions (lines 935–941)

- Before "Feladó e-mail": select "Csatorna" `#em-ch` with options E-mail, Telefonos jegyzet, E-mail csatolmány.
- After "Beérkeztetés és AI feldolgozás": file-picker label button "Fájl beolvasása (.txt, .eml, .csv)" (`#em-file`, accept .txt,.eml,.csv,text/plain).
- Inquiry detail: after the first table, if SAMPLE: button "Újraértelmezés élő Claude-dal" (`data-x="claudeparse"`, disabled with label "Claude dolgozik…" while `i.claudeBusy`); else text "Élő Claude-értelmezés a claude.ai-ban megnyitott oldalon érhető el."

### Árajánlat detail additions (lines 946–953)

- `<details>` "Az ügyfélnek kiküldött ajánlat (e-mail + PDF tartalma)": header "Mészkő-Polgár Kft." / "8154 Polgárdi, Bánya út 1. · adószám 12312312-2-07", quote id; "Címzett: {client}{ · tax}", "Szállítási cím: {zip} {city} {addr}", "Kért szállítás: {date or 'egyeztetés szerint'} · Ajánlat érvényes: {valid}". Table Megnevezés / Mennyiség / Nettó egységár / Nettó, lines plus "Fuvardíj, {trips} forduló" row; footer "Nettó / ÁFA 27% / Bruttó" = `net / net×.27 / gross`. Payment text: end customer → "előre utalás vagy készpénz rakodáskor", else "átutalás, {payDays} nap"; plus weighbridge/CE text. Disabled button "Elfogadom az ajánlatot" with note "← az ügyfél e-mailjében egyedi, aláírt link; elfogadás után a megrendelés automatikusan létrejön".
- "Utánkövetés" section (if follow-ups for this quote): alert per follow-up "**{kind}** ({age}. nap, {status})" + text.

### Számlák additions (line 957–959)

- Panel "Kintlévőség korosítása" (4 bucket rows with bars) + button "Fizetések lekérdezése a Billingóból" (`data-sync="1"`).
- Panel "Követeléskezelő": per dunning item dot (bad if lvl≥3 else warn) "**{lvl}. fok · {client}** {number}, {days} nap · {status}" + text; empty: "Nincs lejárt számla."

### Termékkészlet additions (lines 963–969, 1037–1042)

- Inserted before the existing `grid g3` (stock wrap #2), a 2-column grid:
  - Panel "Műszaknapló — termelés könyvelése", description about tablet entry. Form `shform`: "Receptúra" (select of 4 recipe names), "Feladott anyag (t)" default 1800, "Üzemóra" step 0.5 default 8, button "Műszak könyvelése". Table (latest 6): Műszak (id + "{date} · {who}"), Receptúra, Feladás, t/óra (pill warn if <180 on TOR-01), Kihozatal ("{product} {t} · … · veszteség {loss}").
  - Panel "Minőség és megfelelőség" ("Heti szemeloszlás-vizsgálat (EN 933-1) frakciónként. …"). Form `labform`: "Termék" (own-source products only), "Eredmény" (Megfelel=1 / Nem felel meg=0), "Megjegyzés" default "0,063 mm alatti rész 9% (határérték 7%)", button "Vizsgálat rögzítése". Table (latest 6): id, product, pill "Megfelel" (ok) / "Zárolva" (bad), note.
- Appended after the existing view (stock wrap #1):
  - Panel "Depók közötti átszállítás": form `trform` – Termék, Mennyiség (t) default 300, Honnan (depots), Hová (depots, 2nd preselected), button "Átszállítás könyvelése".
  - Panel "Depófelmérés (drón / GPS)" ("A felmért térfogat × halmazsűrűség összevetve a könyvi készlettel. 3% feletti eltérésnél helyesbítési javaslat."): form `svform` – Depó, Termék, Mért térfogat (m³) default 1000, button "Egyeztetés". Surveys table (if any): Felmérés (id + method), Depó · termék, Mért (t + m³), Könyvi, Eltérés (%), Állapot.
  - Panel "Készletfedezet": columns Termék, Napi átlagos eladás, Szabad készlet, Hány napra elég (bar + days). Footer "A törőüzem heti termelési tervét a Leltár-egyeztető ebből javasolja: ami 10 napon belül elfogy, az kerül előre."

### Üzemi raktár additions (lines 973–976)

- Panel "Munkalapok": columns Munkalap (id + name), Gép, Esedékes, Alkatrész-foglalás (per kit "{part} {qty} {unit} ✓" or "— hiány" when stock < needed), Állapot, action "Lezárás" (`data-x="wo"`) unless 'Lezárva'. Empty: "Nincs nyitott munkalap."
- Panel "Kúttartály-egyeztetés" ("Heti pálcás mérés vs. könyvi készlet (nyitó + töltés − kútautomata kiadásai). 1% feletti eltérés vizsgálatot indít."): form `tankform` "Mért mennyiség (l)" default `round(S.parts[0].qty × 0.982)`, button "Egyeztetés". History alerts "Mért {dip} l · könyvi {book} l · {diff} l ({rel})", dot bad if |rel|>1%.

### Vevői portál (`V.portal`), lines 987–993

- Header "Vevői portál" / "Amit a vevő lát a saját bejelentkezésével (portal.mpkft.hu): ajánlatok elfogadása, szállítások követése, szállítólevelek és számlák, újrarendelés." Right: select "Megtekintés mint" (all clients, `data-xc="portal"`).
- KPI row: "Hitelkeret" (`limit − used` or "—"; sub "szabad, keret {limit}" or "előre fizetés"); "Nyitott ajánlat" (quotes status 'Kiküldve'); "Ma úton" (transports 'Úton'); "Nyitott számla" (sum gross of unpaid non-storno invoices; docs matched by clientName).
- Panel "Ajánlataim": per quote id, lines "{name} {qty}", gross; action: if 'Kiküldve' and no orderId → button "Elfogadom" (`paccept`), else pill: 'Megrendelve' if orderId, 'Készül' if 'Jóváhagyásra vár', else status. Empty "Nincs ajánlat.". Buttons: "Legutóbbi rendelés megismétlése" (if any order; `reorder` with first order in list), "Új ajánlatkérés" (`data-go="inbox"`).
- Panel "Szállításaim" (first 12 non-deleted): Nap (+ truck), Termék, Nettó t ("—" if null), Állapot, Bizonylat (delivery note number + "EKÁER {number}"). Empty "Nincs szállítás."
- Panel "Számláim": number or id, gross, "esedékes {due}", pill 'Kiegyenlítve' / 'Lejárt' (due < TODAY) / status. Empty "Nincs számla."

### AI view addition (line 1000)

- Panel "Folyamat-fázisok: ki dolgozik, hol dönt ember" inserted before "Ügynökök és önállóság": columns Fázis, AI-ügynök, Mit csinál, Emberi döntés, ha… from `PHASES`.

### Fuvarszervezés (`V.dispatch`), lines 1178–1249

- State: `DISP = {tab:'day', date:new Date(TODAY), week:new Date(TODAY), sel:null, rows:'truck'}`. Client colors `var(--c{index%7})` (unknown client → c6). `CLR` palette constant defined but unused here.
- Header (`dispHead`): "Fuvarszervezés" / "A rendszer minden fuvarhoz kiszámolja a legjobb jármű–sofőr párost 30 paraméter alapján (kemény korlátok + költség). A diszpécser mindent módosíthat, és ő fogadja el a tervet; elfogadás után indul az EKÁER-bejelentés és a sofőr appja." Right pill (ai): "{count of all Javasolt trips} javaslat vár elfogadásra". Tabs (`data-x="dtab"`): Napi terv (day), Heti naptár (week), Fuvarlista (list), Járművek és sofőrök (res), Szabályok (rules).

#### Napi terv

- Day nav: "‹" (aria "Előző nap", −1), date input (aria "Nap"), "›" (aria "Következő nap", +1), weekday name in Hungarian (vasárnap…szombat) + " · kamionstop" on Sunday.
- Right controls: select "Sorok" (Járművek / Sofőrök, `data-xc="drows"`); button "Automatikus kiosztás újrafuttatása" (`dauto`, ai style); button "Nap tervének elfogadása ({n})" (`daccall`, disabled if no 'Javasolt' trips that day).
- KPI row: "Fuvar" = count + tonnage; "Elfogadásra vár" (ai color) = Javasolt count; "Ütközés, figyelmeztetés" (red when >0) = trips with warn; "Flotta-kihasználtság" = Σ truckDay.work / (trucks × 12).
- Legend: client color chips + "szaggatott = javaslat · piros keret = ütközés · pirosas sáv = munkaidő vége · a blokk áthúzható másik sorba vagy időpontra".
- Timeline SVG (`#tl`, viewBox width 900, label column 150, header 26, row height 34, min-width 720, aria-label "Napi fuvarterv idővonal — a blokkok húzhatók"): hours 5..19, vertical grid lines each hour, labels on even hours "{h}:00"; red translucent band 18:00–19:00. Rows = trucks (label id, sub type) or drivers (label name, sub leave kind or avail). Sub also "· {pct(work/12)}". Drivers on leave or 'Betegszabadság': grey band "nem elérhető". Trip block: rect at start..start+dur (min width 6), fill client color, opacity 0.55 + dashed (4 3) if 'Javasolt', stroke red 2.5 if warnings, ink stroke if selected; tooltip "{id} · {client} · {product} {t} t · HH:MM–HH:MM" + " · ⚠ {warnings}"; text "{id.slice(7)} {t}t" if width > 58. Trips with null start not drawn. Click → select; drag → reassign (see rules).
- Left: trip panel (`tripPanel`):
  - No selection: "Fuvar részletei" + "Válasszon fuvart az idővonalon vagy a listában. A rendszer megmutatja a 3 legjobb jármű–sofőr párost és azt is, miért zárt ki másokat."
  - Selected: title id + status pill; line "{client} · {product} {t} · {zip} {city} · {km} km · depó: {depot name}"; address rule notes (warn alerts); current assignment alert: "Most: **{truck} · {driver}** HH:MM–HH:MM, {cost} becsült költség" + hard (red) + soft (small).
  - If status not 'Lezárva'/'Úton': "Javaslatok ({okCount} szabályos páros a {total}-ból)" table #, Jármű · sofőr (+ soft notes or "nincs megjegyzés"), Idő, Költség, Pont (first is ok pill), button "Kiválaszt" (`dpick`, first primary). Empty: "Nincs szabályos páros ezen a napon. Tegye át másik napra." `<details>` "Kizárási okok ({n} páros)": aggregated hard reasons (prefix "X: " stripped) with counts, sorted desc.
  - "Kézi módosítás": Nap (date), Indulás (time, default start or 06:00), Jármű (select "{id} · {type} · {cap} t"), Sofőr (select "{name} ({lic})"), Mennyiség (t) (step 0.5), button "Módosítás mentése" (`dsave`).
  - Buttons: "Elfogadom" (`dacc`, only for 'Javasolt'), "Fuvar törlése" (`data-cancel`).
- Right panel "Nem ütemezett mennyiség": per order not 'Lezárva'/'Teljesítve' with rest > 0.1 t: "{id} · {client}: {rest} kiírásra vár" + button "Fuvarok javaslata" (`data-plan`). Empty: "Minden megrendelt mennyiség ütemezve." Subsection "Figyelmeztetések": link per conflicting trip (`dsel`) + warnings; empty "Nincs ütközés."

#### Heti naptár

- Nav: "‹ előző hét" (−7), "{ds(day0)} – {ds(day6)}", "következő hét ›" (+7). Week starts at `DISP.week` (initially TODAY, not snapped to Monday).
- Panel "Járművek foglaltsága": header day abbreviations V/H/K/Sze/Cs/P/Szo + `ds(d).slice(6)`, Sunday class `off`. Rows per truck (id, "{type}, {cap} t"); cell: pill "szerviz" if open work order due that day; if trips: occupancy bar (`occ = work/12`, bad >1, warn >0.85), "{n} forduló · {pct}", client color chips; else "szabad". Cell click → `dgoto` that day.
- Panel "Sofőrök beosztása" ("Kattintás egy cellára: szabadság be/ki (a javaslatmotor azonnal figyelembe veszi)."): row "{name}" / "{lic} · eco {eco}"; cell: leave pill (kind), or "HH:MM–HH:MM" (earliest start – end) + "{n} forduló · vez. {drive} h", or "—". Click → `dleave`. Last column "Heti vez.": pill "{weekDrive(day7)} / 56 h", warn if >48.
- Panel "Megrendelések a héten": rows per day per order: Nap, Megrendelés, Ügyfél, Fuvar count, Tonna, Állapot (Javasolt if any trip Javasolt else Tervezett); row click → `dgoto`. Empty "Nincs fuvar a héten."

#### Fuvarlista

- All non-deleted trips sorted by date then start. Columns: Fuvar, Nap · idő ("HH:MM–HH:MM" or "—"), Ügyfél · termék, t, Jármű (select `lt` unless 'Lezárva' → plain id), Sofőr (select `ld` unless 'Lezárva'), Figyelm. (bad pill with count, tooltip lists warnings), Állapot, actions "Elfogad" (`dacc`, Javasolt only), "Napi nézet" (`dgoto` with id).

#### Járművek és sofőrök

- Panel "Járművek — 15 paraméter", buttons "iTrack szinkron most" (`itsync`), "Új jármű" (`addtruck`). Note: "A zöld fejlécű oszlopokat a rendszer tartja karban (iTrack, tachográf, költségmodell); a többit a diszpécser állítja. 30 napon belül lejáró dátum narancs."
- Table: Rendszám (id + name) then one column per VPARAM; header tooltip "Forrás: {source}", class `auto` if ro or source contains "automatikus".
- Panel "Sofőrök — 15 paraméter", button "Új sofőr" (`adddriver`); Név (name + home) then DPARAM columns.
- Cell rendering (`pinp`): value is computed for `pos` (telemPos), `ftkm` ("{ft} /km"), `dayDrive` ("{drive of DISP.date} / 9 h · heti {weekDrive+drive} h"), `cont` ("szünet beiktatva" if day drive >4.5 else "rendben"), `otUsed` ("{ot} / {otCap} h"); otherwise the field. `ro` → plain text; `sel` → select; else input (number / date / text; widths txt 170px, date 140px, else 80px). Date inputs get class `expiring` when value < TODAY+30 d. All editable cells `data-xc="res"` (change → XC.res).

#### Szabályok

- Panel "Kemény korlátok (kizáró)", list: "Teherbírás ≥ fuvarmennyiség; cím szerinti össztömeg-korlát (pl. Siófok 32 t)"; "Behajtási engedély és EURO-osztály a zónához (Budapest 12 t felett P+, EURO VI)"; "Billentés iránya a lerakóhoz"; "Érvényes műszaki vizsga, nincs aznapi munkalap (szerviz)"; "Vasárnapi kamionstop 7,5 t felett"; "Jogosítvány: nyerges és pótkocsis szerelvényhez CE"; "Szabadság, betegség, elérhetőség (pl. csak délelőtt)"; "Érvényes sofőrkártya és GKI"; "Napi vezetési idő max. 9 h (EU 561/2006), 4,5 h után 45 perc szünet automatikusan"; "Heti 56 h, kéthetes 90 h vezetési idő"; "Napi munkaidő-keret (sofőrönként, max. 12 h)"; "Ügyfél-tiltás".
- Panel "Költség-pontszám (minél kisebb, annál jobb)": "Fuvar-önköltség: oda-vissza km × a jármű Ft/km-e (fogyasztás és EURO-osztály szerint)"; "Kihasználatlan teherbírás büntetése"; "Túlóra-pótlék (8 h felett 50%) és havi túlórakeret"; "Üresjárat, ha a jármű a másik bányában áll"; "Alacsony üzemanyagszint (tankolási idő)"; "Gyakorlatlanság a járműtípuson"; "Ügyfél-preferencia, helyismeret (bónusz)"; "Vezetési stílus (iTrack eco-pont)"; "Terhelés kiegyenlítése a sofőrök között". Footer: "A pontszám 100 = a nap legolcsóbb szabályos párosa. A diszpécser bármelyik javaslatot választhatja, vagy kézzel felülbírálhat; a felülbírált szabály a naplóba kerül."

### Sofőr app (`V.driverapp`), lines 1393–1403 (view continues just past 1400)

- Header "Sofőr app" / "Ez a sofőr telefonján / tabletjén futó nézet (PWA). Átvételkor a vevő itt írja alá a szállítólevelet és — az utolsó fordulónál — a teljesítésigazolást, vagy a sofőr lefotózza a papíron aláírt iratot." Right: select "Sofőr" (`data-xc="drv"` → `DRV.id`).
- Phone frame: driver name + `ds(TODAY)`; KPIs "Mai vezetés" "{drive} / 9 h", "Fordulók" count.
- Trips = driver's trips dated TODAY, status not 'Törölve'/'Javasolt', sorted by start. Card: "{i}. HH:MM · {truck}" + pill ('Átvéve' if pod, else status); "{client} — {zip} {city} {addr}"; "{product} · terv {t} · {km} km · EKÁER {number or 'nem köteles'}".
  - Status 'Tervezett': input "Mérlegjegy nettó (t)" (`w-{id}`, step 0.01, default `planned − 0.3`), hidden `wt-{id}`=0, button "Felrakva, indulok" (`data-close`, handler elsewhere).
  - Status 'Lezárva' without pod: "Szállítólevél: {dn number or —} · {net}"; "Átvevő neve" default (c1 → "Kovács Ferenc építésvezető", c2 → "Tóth Gábor", else "Átvevő"); "Várakozás a lerakón (perc)" default 55 for c1 else 20; signature pad "Átvevő aláírása a szállítólevélre"; if `last` (all order lines delivered ≥ 98% and trip's TIG is 'Aláírásra vár') second pad "Teljesítésigazolás aláírása ({tig id}, a megrendelés utolsó fordulója)"; button "Átvétel rögzítése" (`pod`); photo button "Aláírt papír fotója" (file input accept image/*, capture environment, `data-photo="pod"`).
  - With pod: "Átvette: {name} · {HH:MM hu-HU} · {how}" + signature image.
  - Empty: "Ma nincs elfogadott fuvar ennél a sofőrnél. (A diszpécser elfogadása után jelenik meg.)"
- `X.pod` (1405, just past range): requires delivery signature ("Az átvevő aláírása hiányzik (vagy töltsön fel fotót)."); sets `f.pod = {name, t, img, how:'e-aláírás a sofőr tabletjén', gps:'iTrack pozíció a lerakón'}`, `f.wait`; copies pod to delivery note (`status2='Átvéve'`); log; if TIG signature present → `acceptTIG(t,'device',name,sig)`; toast "Átvétel és TIG aláírva, számla indul." or "Átvétel rögzítve."

## Simulation & time behavior

- No timers in this range. All dates are relative to the fixed `TODAY = 2026-10-03 09:00` (Saturday); dates built from ISO strings use `'T09:00'`.
- Scenario sliders (`SIM`) only change state temporarily inside `withSim`; the real state is restored after each computation.
- Sunday rule: `getDay()===0` is a hard block in `evaluate`; `planTransports` and `autoAssignDay` skip Sundays when moving trips; day nav shows "· kamionstop".
- Driving-time model: per trip drive = km/52 + km/58 h, duration = drive + 0.58 h; day starts no earlier than 6:00 (`prefStart` default 6, or 6 + 0.4 h × slot index from planTransports); limits 4.5 h continuous (+45 min), 9 h daily (10 h max twice a week), 56 h weekly, 90 h per two weeks, daily rest ≥ 9 h (soft < 11 h), work window end = 6 + maxDay (13:00 for 'Csak délelőtt'). Current-week history comes from the static `weekH`/`fortH` seeds; future days add planned drive.
- Auto-assignment re-runs: when `planTransports` creates trips (with spill to the next workday up to 4 levels deep) and on "Automatikus kiosztás újrafuttatása" (no spill).
- Async: `fileDoc` hashes in the background and re-renders when on route 'contracts' or 'tig'.
- Seed-time simulated events in range: two shifts posted (1760 t / 8 h on TOR-01+OSZT-01, which gives 220 t/h; 2400 t / 9 h Csúcsoshegy), five passing lab samples, two sent quotes, payment sync, follow-ups, collections, maintenance run, and a drone survey of CSU-1/p5 at 2550 m³.
