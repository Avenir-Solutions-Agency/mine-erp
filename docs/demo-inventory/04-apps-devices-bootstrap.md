# Functional inventory, part 4: lines 1400–2043 (end of file)

Source: the single-file demo HTML (artifact-83f2330b...). Line numbers are given as `Lnnnn`.
Context lines read outside the range only to explain calls: L1384–1399 (sigPad, bindSig, sigData, readPhoto, start of V.driverapp), L470–475 (go/toast), L731–760 (render, change and click delegation).

Conventions used by the demo (defined before the range, used here):

- `X.<key>(dataset, el)`: click actions, dispatched from `[data-x="<key>"]` by the global click handler (L750).
- `XC.<key>(el)`: change actions, dispatched from `[data-xc="<key>"]` by the global change handler (L739).
- `render()` = `renderNav(); main.innerHTML = V[route](); bindForms()`.
- `go(r)`: sets `route`, saves it to `localStorage['mperp-route']` (try/catch), renders, scrolls to top.
- `toast(m)`: does nothing while `SEEDING`; otherwise shows `#toast` for 3400 ms.
- `log(actor, text, ref?)` appends to the audit log; `job(system, title, key, payload, fn)` queues and runs an integration job (Billingo and others); `approval(kind, refId, title, detail, suggestion)` creates an approval item.
- Many views in this range **wrap** an earlier view (`const _x = V.x; V.x = () => _x().replace(...)`). Each wrap is listed below.

---

## Business rules

### Driver app: proof of delivery (L1399–1415). The view starts at L1393 and is completed here.

- For each of the driver's transports today with `status==='Lezárva' && !f.pod`, the card shows:
  - `Szállítólevél: <dn.number|—> · <tn(f.net)>`
  - Input `Átvevő neve` (`#pn-<fid>`). Default: `'Kovács Ferenc építésvezető'` if clientId `c1`, `'Tóth Gábor'` if `c2`, otherwise `'Átvevő'`.
  - Input `Várakozás a lerakón (perc)` (`#pw-<fid>`, number). Default: 55 for `c1`, otherwise 20.
  - Signature pad `ps-<fid>` with the label `Átvevő aláírása a szállítólevélre`.
  - Only if `last` is true: a second pad `pt-<fid>` with the label `Teljesítésigazolás aláírása (<tig.id>, a megrendelés utolsó fordulója)`. `last` (L1396) means every order line has `delivered >= qty*0.98` AND a TIG `f.tig` with status `Aláírásra vár` exists.
  - Buttons: `Átvétel rögzítése` (`data-x="pod"`) and a file label `Aláírt papír fotója` (`accept="image/*" capture="environment"`, `data-photo="pod"`).
- After POD: `Átvette: <name> · <HH:MM hu-HU> · <how>`, plus the signature image if `f.pod.img` is set.
- Empty state: `Ma nincs elfogadott fuvar ennél a sofőrnél. (A diszpécser elfogadása után jelenik meg.)`
- `XC.drv(t)`: sets `DRV.id = t.value`, then renders.
- `X.pod(d)`:
  - Reads `sigData('ps-'+id)`. If it is empty: toast `Az átvevő aláírása hiányzik (vagy töltsön fel fotót).` and return.
  - Reads the optional `tsig = sigData('pt-'+id)`.
  - Sets `f.pod = {name: #pn value, t: new Date(), img: sig, how: 'e-aláírás a sofőr tabletjén', gps: 'iTrack pozíció a lerakón'}` and `f.wait = +#pw || 0`.
  - The linked delivery-note doc (`S.docs` id `f.dn`) gets `dn.pod = f.pod` and `dn.status2 = 'Átvéve'`.
  - `log('Sofőr (<driver>)', 'Átvétel rögzítve: <name>, várakozás <wait> perc', f.id)`.
  - If `tsig` is set: `acceptTIG(tig, 'device', pod.name, tsig)`.
  - Renders. Toast: `Átvétel és TIG aláírva, számla indul.` if tsig, otherwise `Átvétel rögzítve.`
- Global change listener for `[data-photo]` (L1409). It runs `readPhoto` (downscales to a max of 900 px, JPEG quality 0.75), then branches on `data-photo`:
  - `pod`: `f.pod = {name:'papíron aláírva', t: now, img, how:'aláírt szállítólevél fotója', photo:true}`. Sets the dn pod and `status2='Átvéve'`. Then `fileDoc('Aláírt szállítólevél (fotó)', f.id, '<dn.number|f.id> — <filename>', img.slice(0,2000), 'Sofőr (<driver>)')`. Toast `Fotó csatolva és iktatva.`
  - `tig`: `acceptTIG(tg,'photo','papíron aláírt példány',img)`. Toast `Aláírt TIG csatolva, számla indul.`
  - `contract`: `signContract(c,'photo','aláírt papírpéldány',img)`. Toast `Aláírt szerződés feltöltve és iktatva.`
  - `extdn`: `S.extdn.unshift({t: now, img, name})`, then `log('Raktáros (ember)','Külsős szállítólevél rögzítve: <name>')`. Toast `Külsős szállítólevél csatolva.`
  - Every branch then calls `render()`.
- `S.extdn = []` is initialized at L1415.

### Contracts (L1417–1434)

- State: `CSUB` (`'list'|'tpl'|'reg'`) and `sel.contract`. The current contract is the selected one or `S.contracts[0]`.
- `X.csub(d)`: `CSUB=d.k`, then renders. `X.copen(d)`: `sel.contract=d.id; CSUB='list'`, then renders.
- `X.csend(d)`: sets `status='Kiküldve'`, `sent=now`, and pushes history `[now,'Értékesítő (ember)','Kiküldve aláírásra']`. Every approval with `refId===c.id && status==='Vár'` becomes `'Jóváhagyva'`. Renders. No toast.
- `X.cremind(d)`: pushes history `[now,'AI · Szerződéskészítő','Emlékeztető e-mail az aláírásról']`, renders, toast `Emlékeztető elküldve.`
- `X.cportal(d)`: `sel.portal = c.clientId; go('portal')`.
- `X.tplsave()`: `S.ctemplate = #tpl-t.value`, `log('Tulajdonos','Szerződéssablon módosítva')`, toast `Sablon mentve.` (no render).
- `regTable()`: the registry table built from `S.registry` (fields no, date, type, title, by, hash). The hash shows the first 16 chars plus `…`.

### TIG (completion certificate) (L1436–1451)

- The current TIG is `sel.tig` or `S.tigs[0]`. `L = tigLines(cur)` (defined outside the range) supplies rows, tons, prod, fr, wait and total.
- `X.topen(d)`: `sel.tig=d.id`, then renders.
- `X.tmake(d)`: `createTIG(d.id,'Kézzel indított TIG a lezárt fordulókról')`, then `sel.tig = t && t.id`, then renders.
- `X.tsign(d)`: needs `sigData('ts-sig')`. If it is empty: toast `Az aláírás hiányzik.` Otherwise `acceptTIG(t,'e', #ts-n value, sig)`, renders, toast `Teljesítés elfogadva, iktatva, számla elindult.`
- `X.tobj(d)`: sets `status='Kifogásolva'`. `noPod` = ids of the TIG rows without `f.pod`. Then `t.objection` is set to:
  - If noPod is non-empty: `Vevő: „Az egyik forduló nem érkezett meg.” — Ellenőrzés: átvételi aláírás nélküli fordulók: <ids>; iTrack szerint mindegyik jármű 15 percnél tovább állt a lerakó POI-ján. Javaslat: az iTrack-útvonal és a mérlegjegy megküldése a vevőnek, TIG változatlan újraküldése.`
  - Otherwise: `Vevő: „Az egyik forduló nem érkezett meg.” — Ellenőrzés: minden fordulóhoz van átvételi aláírás — javaslat: az aláírt szállítólevelek megküldése, TIG változatlan újraküldése.`
  - Pushes history `[now,'Vevő','Kifogás']`, then renders.

### Portal signing (L1453–1460)

- `V.portal` wraps the original. It collects contracts of client `sel.portal` with status `Kiküldve` and TIGs with status `Aláírásra vár`. If either list is non-empty, it inserts an `Aláírásra vár` panel before the first `<div class="grid g2" style="margin-top:14px">` of the original output.
- `X.pcsign(d)`:
  - If checkbox `#cs-ok-<id>` is unchecked: toast `Jelölje be a nyilatkozatot.`
  - If there is no signature on `cs-s-<id>`: toast `Az aláírás hiányzik.`
  - Otherwise `signContract(c,'e', #cs-n-<id>, sig)`, renders, toast `Szerződés aláírva és iktatva.`
- `X.topen2(d)`: `sel.tig=d.id; go('tig')`.

### Telematics (iTrack), simulated (L1462–1519)

- `GEO` (lat, lon, label):
  - `POL [47.058,18.305,'Polgárdi bánya']`
  - `CSU [47.083,18.262,'Csúcsoshegy']`
  - `BAL [46.93,17.75,'Balatonrendes']`
  - `'8000' [47.19,18.41,'Székesfehérvár']`
  - `'1134' [47.53,19.07,'Budapest XIII.']`
  - `'8600' [46.905,18.05,'Siófok']`
  - `'8200' [47.09,17.91,'Veszprém']`
  - `'8156' [46.96,18.39,'Kisláng']`
- `geoOf(zip)`: `GEO[zip]`. If missing: `GEO['1134']` when the zip starts with `'1'`, otherwise `GEO['8000']`.
- `routePts(a,b,n=24)`: returns n+1 points. For t=i/n: `bend = sin(πt)*0.04*(b.lon>a.lon?1:-1)`, `lat = a.lat+(b.lat-a.lat)t+bend`, `lon = a.lon+(b.lon-a.lon)t-bend*0.5`.
- State `S.telem={}`, `S.trips=[]`, `S.tEvents=[]` and `S.refuels=[]` are created at L1467.
- `itrackSync()`. For each truck i:
  - It takes today's transports of that truck that are not `Törölve`, sorted by `start`.
  - `moving` = the first `Lezárva && !pod`, otherwise the first `Úton`.
  - Home: `GEO[t.home]||GEO.POL`. Default: `place='<home label> (telephely)'`, speed 0.
  - If `moving` exists: dst = `geoOf(order.zip)`, `pos = routePts(home,dst)[14]`, `place='úton → <dst label>'`, `speed = 62+i*3`.
  - Writes `S.telem[id] = {lat, lon, place, speed, ign: speed>0, fuel: t.fuel, odo: t.km, upd: 'ma 09:0'+i}`.
  - Logs `('Integráció','iTrack WebService szinkron: járműlista, utolsó pozíciók, sebesség, mérőcsatornák (üzemanyagszint, km-óra), tankolások')`.
- `buildTelemStats()`:
  - Trips, for each `Lezárva` transport f (index i):
    - `a = GEO[P(f.pid).depot.slice(0,3)]||GEO.POL`, `b = geoOf(order.zip)`, `t = TR(f.truck)||S.trucks[0]`.
    - `km = (f.km||distKm(zip))*2`.
    - `l = km*t.cons/100*(1+(f.net||f.planned)/80)`.
    - `stopMin = (f.wait||20)+15`, `maxSpeed = 82+(i%4)*3`, `idle = 8+(i%5)*3`.
    - Pushes `{fid, truck, driver: driverId, date, km, l, pts: routePts(a,b), from: a label, to: b label, stopMin, maxSpeed, idle}`.
  - Per-truck stats `S.tstats`:
    - Base table `[km, events]`: RKX-412 [5120,11], SMP-118 [4870,19], PLG-305 [4410,7], PLG-411 [3020,5], SMP-207 [2780,9], RKX-530 [2550,14]. Default [1000,3].
    - `kmT = base + Σ own trip km`, `cons = t.cons*(1+(i%3-1)*0.04)`, `fuelL = kmT*cons/100`.
    - `tankL = fuelL*1.07` for SMP-118, otherwise `fuelL*1.005`.
    - `hours = kmT/49`, `diff = tankL-fuelL`, `idlePct = 9+(i*3)%11`, `over = ev`, `harsh = round(ev*0.6)`, `stops = round(kmT/38)`.
  - Per-driver stats `S.dstats`, by index:
    - km [4980,4620,3960,4300,1200,2700,3100] (default 2000), `drive = km/49`, `eco = d.eco`.
    - over [6,17,3,9,2,12,5] (default `2+(i*7)%14`).
    - harsh [3,9,2,5,1,8,3] (default `1+(i*3)%8`).
    - idle [7,14,6,9,8,12,7] (default `5+(i*5)%9`).
    - cons [33.1,36.2,30.0,33.9,34.5,31.8,33.0] (default `S.trucks[i]?.cons||33`).
  - `S.refuels`, 4 fixed rows:
    - 10-01 06:12 SMP-118 Polgárdi kúttartály 410/410 ok
    - 10-02 14:40 SMP-118 `MOL Székesfehérvár (kártya)` 180/260 not ok
    - 10-02 05:58 RKX-412 Polgárdi kúttartály 395/395 ok
    - 10-03 06:05 PLG-305 Polgárdi kúttartály 310/310 ok
  - `S.tEvents`, 5 fixed rows:
    - `10-02 11:24 SMP-118 D2 'Gyorshajtás 98 km/h (M7, 90 km/h tehergépkocsi-korlát)'`
    - `10-02 13:02 SMP-118 D2 'Hirtelen fékezés'`
    - `10-01 09:47 RKX-530 D7 'Alapjárat 34 perc a lerakón'`
    - `10-03 07:15 RKX-412 D1 'POI-érkezés: V-Híd, Váci út 45. (lerakó)'`
    - `10-03 08:10 RKX-412 D1 'POI-távozás: V-Híd — tartózkodás 55 perc → állásidő 25 perc'`
- `mapSVG(highlight)`:
  - Canvas W=720, H=420. Bounds: lon 17.6–19.5, lat 46.8–47.62. `X(lo)=(lo-17.6)/1.9*W`, `Y(la)=H-(la-46.8)/0.82*H`.
  - Draws a background rect (`--surface2`), a Balaton polygon (10 points, `--water`), a Velence polygon (4 points), the M7 polyline (stroke 3, `--road`), the M8 polyline (stroke 2) and the label `M7`.
  - GEO points: 3-character keys (sites) get r=5 and `--accent`; zip keys get r=3.5 and `--muted`. Each has a text label.
  - Each trip is a polyline with `data-x="tsel" data-id=fid`. Highlighted: stroke `--ai`, width 4, opacity 1. Others: `--accent`, 1.5, opacity .35. Tooltip `<fid> · <truck> · <from> → <to>`.
  - Each telem vehicle gets a 48×15 label rect with the plate and a circle r=4. Colour is `--ai` if speed>0, otherwise `--ink`.
  - Wrapped in `<div class="tw"><svg class="chart map" ... style="min-width:560px" role="img" aria-label="Járművek és útvonalak térképe">`.
- `X.tsel(d)`: `TSUB.sel=d.id`. `XC.tsel(t)`: `TSUB.sel = t.value||null`. Both render.

### Delivery notes (L1521–1547)

- Filter state `DNF={q,st,client}`.
- `dnState(d)`, evaluated in this order:
  1. `status==='Sztornó'` → `Sztornó`
  2. transport `d.ref` has `inv` → `Számlázva`
  3. `d.pod` → `Átvéve (aláírva)`
  4. `d.number` → `Úton / átvételre vár`
  5. otherwise `Kiállításra vár`
- `dnRows()`: docs of type `Szállítólevél`, filtered by state equality, clientName equality, and a case-insensitive substring of `number+ref+order`.
- `dnDoc(d)`: the printed delivery-note sheet.
  - Gross = `qty + (truck cap>20 ? 15.2 : 12.4)` (2 decimals). Tare = gross−qty.
  - Seller is fixed: `Mészkő-Polgár Kft.`, `8154 Polgárdi, Bánya út 1.`, `Adószám: 12312312-2-07`.
  - Weigh ticket no: `MJ-<f.id.slice(7)>`.
  - DoP line: `Teljesítménynyilatkozat: DoP-MP-<PID UPPER>-2026 · CE · MSZ EN 13242`.
  - EKÁER shows `f.ekaer.number` or `nem bejelentésköteles`.
  - POD block or `Átvevő aláírása: —`.
- KPI `unsigned` = notes with `!pod && number && (TODAY-created)/864e5 >= 1`. `noDn` = `Lezárva` transports without `dn`.
- `XC.dnq`, `XC.dnst` and `XC.dncl` set DNF.q, DNF.st and DNF.client, then render. `X.dnopen(d)`: `sel.dnd=d.id`, then renders.
- `X.dnresend(d)`: `job('Billingo','Szállítólevél újraküldése', id+'-r'+Date.now(), {endpoint:'POST /v3/documents/<id>/send'}, ()=>'elküldve')`. Toast `Újraküldve.`, then renders.
- `X.dncorr(d)`:
  - `qty = +(qty-0.2).toFixed(2)`.
  - `amount = qty*(amount/(qty+0.2))`, which keeps the unit price.
  - `job('Billingo','Szállítólevél módosítás', id+'-m'+Date.now(), {qty}, ()=>'módosítva')`.
  - `log('Diszpécser (ember)','Tömeg-korrekció: <number> → <qty> t (mérlegjegy újramérés)', id)`.
  - Renders. No toast.
- `X.dnstorno(d)`:
  - Sets `status='Sztornó'`.
  - `job('Billingo','Szállítólevél sztornó', id+'-s', {endpoint:'POST /v3/documents/<id>/cancel'}, ()=>'sztornózva')`.
  - Logs `Szállítólevél sztornózva: <number>`, then renders. No toast.

### Invoices (L1549–1581, wrapped again at L1889–1907)

- `S.inbound`, initial 4 rows (net in Ft):
  - BE-1: MOL Nagykereskedelem, MOL-2026-884120, 2026-10-01, net 16 020 000, due 10-16, PO-2026-19, `Gázolaj 28 600 l`, rec `28 600 l bevételezve`, status `Egyeztetve`.
  - BE-2: Fuchs Hungária, FU-26-11873, 09-29, 612 000, due 10-29, PO-2026-17, `Hidraulikaolaj 400 l`, `380 l bevételezve`, `Eltérés: 20 l`.
  - BE-3: Bányarobbantó Kft., BR-2026-0931, 09-30, 4 200 000, due 10-15, `keretszerződés`, `Szeptemberi robbantások (3 alkalom)`, `robbantási napló: 3 alkalom`, `Egyeztetve`.
  - BE-4: Sandvik márkaszerviz, SV-2026-3304, 10-02, 2 850 000, due 11-01, `—`, `Ütőléc-készlet QI440`, `nincs bevételezés`, `Rendelés nélkül`.
  - L1890 adds BE-5: Komatsu márkaszerviz, KM-2026-0912, 10-02, 1 240 000, due 11-01, `—`, `D61PX hidraulikaszivárgás javítása, kiszállással`, `munkalap nincs`, `Rendelés nélkül`.
  - L1890 adds BE-6: Gumiker Kft., GK-26-5521, 10-01, 2 900 000, due 10-31, PO-2026-16, `2 db 23.5R25 abroncs`, `2 db bevételezve (QR)`, `Egyeztetve`.
- `invType(d)`: `d.kind`. If missing: `Gyűjtőszámla (havi)` when `ref==='szeptemberi teljesítés'`, otherwise `Számla (TIG alapján)`.
- `INVF={tab:'out', q:'', type:''}`. `X.invtab(d)`, `XC.invq` and `XC.invt` set tab, q and type, then render.
- The gross used everywhere is `d.gross || d.amount*1.27`.
- `X.markpaid(d)`: `paid=true`, `status='Kiegyenlítve'`, log `('Pénzügy (ember)','Kiegyenlítés kézzel: <number>')`, renders.
- `X.corrinv(d)` (corrective invoice):
  - New doc: `{id: nid('SZ'), type:'Számla', kind:'Helyesbítő számla', ref: x.number, order, clientName, amount: -round(x.amount*0.02), gross: -round(x.amount*0.02*1.27)}`.
  - Single item `{name:'Helyesbítés <number>: tömeg-korrekció', unit_price: -round(amount*0.02), unit_price_type:'net', quantity:1, unit:'tétel', vat:'27%'}`.
  - Other fields: `created: now`, `status:'Sorban (Billingo)'`, `nav:'—'`, `payload:{type:'modification', original}`.
  - The doc is unshifted onto S.docs. Then `job('Billingo','Helyesbítő számla', id, payload, fn)` where fn sets `status='Billingóban kiállítva'`, `number='MP-2026-'+pad4(++SEQ.SZ)`, `nav='Befogadva'`.
  - Sets `sel.doc`, then renders.
- `X.newadv()` (pro forma):
  - Client `C('c4')`. Doc kind `Díjbekérő`, ref `A-2026-92 (magánszemély)`, order `—`.
  - amount 143021, gross round(143021*1.27). Item `0/1 mosott homok 15 t + fuvar (előre fizetés)` ×1 `tétel`.
  - due `addDays(TODAY,3)`, nav `nem NAV-köteles (díjbekérő)`, payload `{type:'proforma'}`.
  - The job sets the fixed number `MP-E-2026-0007`.
  - Toast `Díjbekérő kiküldve; a fuvar a befizetés után szabadul fel.`
- `X.inok(d)`: `b.status='Fizetésre jóváhagyva'`, log `Bejövő számla fizetésre jóváhagyva: <no>`, renders.
- `aiMach(b)` (cost-centre suggestion for an inbound invoice):
  - `txt = lower(item+' '+sup)`.
  - It looks for the first non-`fuvar` machine whose id appears in txt, or whose name contains a word of more than 3 characters with a digit that appears in txt. Match → `{m: id, why: 'a tételben a <name words 2–3> típusjel szerepel'}`.
  - Otherwise, in order:
    - `/gázolaj|üzemanyag/` → `{m:'KÚT', why:'üzemanyag: a kúttartályba; gépre az RFID-tankoláskor kerül'}`
    - `/robbant/` → `{m:'—', why:'nem gépköltség: kitermelés költséghely'}`
    - `/23\.5r25|abroncs/` → `{m:'RAK-01', why:'a 23.5R25 abroncs a RAK-01…03 rakodókhoz kompatibilis; a QR-kiadás dönti el a gépet'}`
    - `/hidraulika/` → `{m:'TOR-01', why:'QR-kiadás 10. 02.: 40 l HV46 → TOR-01'}`
    - else `{m:null, why:'nem találtam gépet'}`.
  - At L1898 every inbound row gets `b.ai = aiMach(b)`.
- `XC.inm(t)`: `b.mach = t.value||null`, log `('Pénzügy (ember)','Bejövő számla költséghelye: <no> → <mach|—>')`, renders.
- `X.inai(d)`: `b.mach = b.ai.m`, log `AI-javaslat elfogadva: <no> → <mach>`, renders.
- Posting readiness: `ready = b.mach && b.mach!=='?'`.
  - If ready and status is `Egyeztetve` or `Fizetésre jóváhagyva`: pill `feladható`.
  - If ready otherwise: a warn pill showing the status.
  - If not ready: pill `gépazonosító hiányzik`.

### Payroll preparation (L1583–1642; the employee list is replaced at L1736–1753)

- `PAYCFG = {szja:0.15, tb:0.185, szocho:0.13, ot:0.5, night:0.15, shift:0.30, sunday:0.5, divisor:174, minWage:322800, guaranteed:373200, ecoHi:30000, ecoMid:15000, waitPaid:true}`.
- `S.employees`:
  - Drivers: one per `S.drivers[i]`, with `{id, name, role:'Gépkocsivezető', stage:'fuvar', kind:'driver', rate, perTrip, eco, sunday:0}` and these per-index monthly arrays:
    - att [196,214,171,188,96,176,192]
    - drive [148,163,124,139,61,118,145]
    - night [6,14,0,4,0,2,8]
    - trips [92,98,74,86,38,70,81]
    - tripsOk [92,96,74,86,38,69,81]
    - wait [9,6,4,7,1,5,6]
    - leave [0,0,1,0,9,0,0]
    - Fallback formulas apply beyond index 6.
  - Final non-drivers (L1737, replaces the L1587–1596 list), monthly gross in Ft:
    - E1 Kovács Imre, Dózerkezelő, kitermeles, 690 000, att 182
    - E2 Pap József, `Rakodógép-kezelő (törő)`, toro, 645 000, att 194, night 22, shiftH 64
    - E3 Lakatos Ernő, `Rakodógép-kezelő (törő)`, 645 000, att 201, night 30, shiftH 72
    - E4–E8 Simon Dávid, Farkas Tamás, Balogh Sándor, Kelemen Áron, Vincze Zsolt: `Rakodógép-kezelő`, rakodas, 650 000, att [190,184,176,188,172]; leave 1 for Balogh
    - E9 Major Gergely, Szerelő, rezsi, 720 000, att 186, woH 118
    - E10 Nagy Levente, Szerelő, 720 000, 178
    - E11 Szabó Bálint, Szerelő, 720 000, 170
    - E12 Zoli, Fuvarszervező, 720 000, 180
    - E13 Andi, Irodavezető, 780 000, 170
    - E14 Tóth Erika and E15 Kis Bernadett, `EKÁER/admin`, 520 000, 168
    - E16 Szilvi, Könyvelő, 690 000, 168
    - E17 Misi, `Vevőkezelés, bányai admin`, 560 000, 172
    - E18 Horváth Judit, same role, 480 000, 168
    - E19 Fodor Lajos, Hulladéklerakó-kezelő, 480 000, 176
    - E20 Matyi, `Bánya és raktár (menedzsment)`, 1 300 000, 168
    - All of them: kind `monthly`, night 0, leave 0 unless stated.
- `S.payroll = {period:'2026. szeptember', status:'Előkészítve', work:168, steps:[['Előkészítve','ma 06:00','Rendszer: jelenlét, tachográf/iTrack, TIG, munkalap, műszaknapló beolvasva']], periodKey:'szept'}`.
- `liveEmp(e)` (the `okt` period):
  - Driver:
    - `ts` = transports of the driver that are not `Törölve` or `Javasolt`, dated 2026-10-01..TODAY. `done` = the `Lezárva` ones. `days` = distinct dates.
    - `att = round1(Σdur + days*1.0)`, `drive = round1(Σdrive)`.
    - `night = round1(Σ (max(0,6-start) + max(0,end-22)))` where `start = f.start||6` and `end = start+dur`.
    - `trips = done.length`, `tripsOk` = done with `pod || tigOk(f)`, `wait = round(Σwait/6)/10` (hours with 1 decimal).
    - `leave`: if any `S.leave` row has `d===e.id && from<=today && to>='2026-10-01'`, then `min(2, round((min(to,TODAY) - max(from,'2026-10-01'))/864e5)+1)` using the first leave row of the driver; otherwise 0.
    - `live = ts`.
  - Non-driver:
    - `sat` = `S.shifts` dated today.
    - `crush` = role matches `/törő/i` and some shift recipe starts with `TOR-01`. `quarry` = role `Bányamester` and some shift site `CSU`.
    - `sh = crush ? thatShift.hours : quarry ? 9 : 0`.
    - Returns `att=16+sh`, `night=0`, `shiftH=0`, `leave=0`.
- `empsFor()`: `S.employees.map(liveEmp)` if periodKey is `okt`, otherwise `S.employees`.
- `payCalc(e)`: each line is `[name, round(value), source]`. `W = S.payroll.work`, which `V.payroll` sets to 16 for okt and 168 otherwise.
  - Driver:
    - `reg = min(att, W - leave*8)`. Line `Alapbér (órabér × ledolgozott rendes óra)` = rate*reg, source `jelenléti terminál`.
    - If leave: `Távolléti díj (<n> nap szabadság)` = rate*8*leave, source `szabadság-nyilvántartás`.
    - `ot = max(0, att-W)`. If ot: `Túlóra <ot> h (+50%)` = ot*rate*1.5, source `jelenlét − <W> h`.
    - If night: `Éjszakai pótlék <n> h (+15%)` = night*rate*0.15, source `iTrack menetidő 22–06`.
    - Always: `Teljesítménybér <tripsOk> igazolt forduló × <perTrip Ft>` = tripsOk*perTrip, source `átvétel/TIG-gel igazolt fordulók`.
    - Eco bonus (szept only): eco>=85 → 30000, eco>=75 → 15000, else 0. Line `Eco-prémium (iTrack eco-pont <eco>)`, source `iTrack események`.
  - Monthly:
    - `hr = gross/174`.
    - Base: okt → `Időarányos alapbér (2 munkanap)` = hr*16; szept → `Havi alapbér` = gross. Source `munkaszerződés`.
    - Overtime as for drivers, with hr instead of rate.
    - If shiftH: `Műszakpótlék <h> h (+30%, 18–06)` = shiftH*hr*0.30, source `műszaknapló`.
    - If night and no shiftH: `Éjszakai pótlék <n> h` = night*hr*0.15, source `jelenlét`.
  - Totals: `gross = Σlines`, `szja = 15%`, `tb = 18.5%`, `net = gross - szja - tb`, `szocho = 13%`, `cost = gross*1.13`. Totals are not rounded.
- `payChecks()` returns a list of `[level, emp, text]`:
  - Driver:
    - If `att-drive` > 8 (okt) or > 60 (szept): warn `jelenlét <att> h, menetidő <drive> h — <diff> h rakodás/várakozás; ellenőrizendő`.
    - If `trips>tripsOk`: warn `<n> forduló átvételi igazolás nélkül — a teljesítménybérbe nem számít bele, amíg nincs TIG/aláírt szállítólevél`.
    - If `att-work > 40`: bad `havi túlóra <n> h — éves 250 h keret mellett ütemesen túllépi`.
    - Szept only: if `drive > DR(id).weekH*4.3+20`: warn `tachográf szerinti vezetési idő eltér a heti összesítőtől`.
  - Monthly: if `shiftH && att>200`: warn `<att> h jelenlét; 12 órás műszakok 11 óránál rövidebb pihenővel (műszaknapló 09.18–19.)`.
  - Szept only, all employees: if `gross < 373200 && leave<5`: bad `bruttó <ft> a garantált bérminimum alatt`.
- Workflow, as `status → [button label, action]`:
  - `Előkészítve` → [`AI-ellenőrzés kész`, payai]
  - `AI-ellenőrzés kész` → [`Vezetői jóváhagyás`, payok]
  - `Jóváhagyva` → [`Export a bérszámfejtőnek`, payexp]
  - `Exportálva` → no button.
  - `X.payai()`: status `AI-ellenőrzés kész`, step `['AI-ellenőrzés kész','ma 06:05','<n> tétel ellenőrzésre jelölve']`, log `('AI · Bérelőkészítő','Szeptemberi bérek ellenőrizve: <n> figyelmeztetés')`.
  - `X.payok()`: status `Jóváhagyva`, step `['Jóváhagyva', HH:MM, 'Ügyvezető jóváhagyta']`, log `('Tulajdonos','Szeptemberi bérelőkészítés jóváhagyva')`.
  - `X.payexp()` (async): status `Exportálva`, step `['Exportálva', HH:MM, 'CSV a bérszámfejtő programnak (Nexon / Kulcs-Bér import)']`, log `('Pénzügy (ember)','Bérfeladás exportálva')`, renders. Then the CSV download (see Device section). Errors are swallowed.
- `XC.payper(t)`: `periodKey = t.value`; `period` = `'2026. október 1–3.'` (okt) or `'2026. szeptember'`. Renders.
- `XC.paycfg(t)`: `PAYCFG[k] = value/100`. `XC.paycfg2(t)`: `PAYCFG[k] = +value`. Both render.
- `X.paysel(d)`: `PAYSEL=d.id` (default `'D1'`), then renders.
- Registers agent `{id:'payroll', name:'Bérelőkészítő', does:'Jelenlétből, menetidőből, igazolt fordulókból, munkalapokból bért előkészít, eltéréseket jelez, exportál.', mode:'suggest'}`.
- Adds to PHASES: `['Bérszámfejtés','Bérelőkészítő','jelenlét + menetidő + igazolt fordulók → bérjegyzék-előnézet, ellenőrzés','vezetői jóváhagyás, export']`.

### QR warehouse (L1644–1694)

- `S.locs`:
  - MUH-A1 `Műhely raktár A/1 polc`
  - MUH-A2 `Műhely raktár A/2 polc`
  - MUH-B1 `Műhely raktár B/1 (nagy alkatrész)`
  - OLAJ `Olajraktár`
  - KUT `Kúttartály (25 m³)`
  - CSU-K `Csúcsoshegy konténer`
- Part locations `PLOC`: s1 KUT; s2–s4 OLAJ; s5 MUH-A2; s6, s7, s9 MUH-B1; s8 MUH-A1. Default MUH-A1. Applied as `p.loc`.
- `S.projects`: REKULT `Csúcsoshegy rekultiváció (2026)`, BANYAUT `Bányaút-karbantartás`, TORO-FELUJ `QI440 törő felújítás`.
- `S.units`: MUHELY `Műhely (általános)`, TOROUZEM `Törőüzem`, IRODA `Iroda`.
- Code schemes (kind in parentheses):
  - Parts: `MP-CIKK-<ID UPPER>` (Cikk)
  - Locations: `MP-HELY-<id>` (Raktárhely)
  - Machines: `MP-JMU-<id>` if stage `fuvar` (Tehergépkocsi), otherwise `MP-GEP-<id>` (Gép)
  - Projects: `MP-PRJ-<id>` (Projekt)
  - Units: `MP-EGY-<id>` (Egység)
  - Open work orders (status ≠ Lezárva): `MP-ML-<id.slice(3)>` (Munkalap), name `<woId> · <machine name>`
  - POs with status `Megrendelve (PO)`: `MP-PO-<id.slice(3)>` (Beszerzési rendelés), name `<poId> · <name>`
- `qrLookup(code)`: trims and uppercases, then finds the first match in the order items, locs, targets, POs.
- `qrImg(code)`: `new QRious({value, size:180, level:'M', background:'#ffffff', foreground:'#000000'}).toDataURL()`, cached in `QRCACHE`. Returns `''` if the library is missing or throws.
- `SCAN` state: `{mode:'issue', item, target, loc, po, qty:'', msg:'Olvassa be a cikk QR-kódját.', count:{}}`. `S.qrlog=[]`.
- `scanInput(raw)`: unknown code → msg `Ismeretlen kód: <raw>`. Otherwise by mode:
  - receive:
    - PO: sets po; item = the part matching `po.sid`; `qty = po.qty`; msg `Rendelés: <po.name>, <qty> — olvassa be a raktárhelyet.`
    - Cikk: sets item; msg `Mennyiség, majd raktárhely QR.`
    - Raktárhely: sets loc; msg `Ellenőrizze a mennyiséget és rögzítse.` if an item is set, otherwise `Olvassa be a cikket.`
    - Other kinds: `Bevételezésnél cikk, rendelés vagy raktárhely kód kell.`
  - issue:
    - Cikk: sets item; msg `Mennyiség, majd a cél QR-kódja (gép, tehergépkocsi, projekt, egység, munkalap).`
    - Gép, Tehergépkocsi, Projekt, Egység or Munkalap: sets target; msg `Rögzítheti a kiadást.` if an item is set, otherwise `Olvassa be a cikket.`
    - Other kinds: `Kiadásnál cikk és cél kód kell; raktárhely nem.`
  - move:
    - Cikk: sets item; msg `Olvassa be az új raktárhelyet.`
    - Raktárhely: sets loc; msg `Rögzítheti az áthelyezést.`
    - Other kinds are ignored and the msg stays unchanged.
  - count:
    - Raktárhely: sets loc, resets `count={}`; msg `Leltár: <loc name>. Olvassa be a polcon lévő cikkeket, adja meg a darabszámot.`
    - Cikk without a loc: msg `Először a raktárhelyet olvassa be.`
    - Cikk with a loc: sets item; msg `Írja be a megszámolt mennyiséget, majd Rögzítés.`
- `scanCommit()`: `p` = the selected part, `q = +SCAN.qty`.
  - issue:
    - Needs p, target and q>0, else toast `Cikk, mennyiség és cél kell.` If `q>p.qty`: toast `Nincs elég készlet (<qty> <unit>).`
    - Gép or Tehergépkocsi: `issuePart(p.id,q,target.ref)`; costTo `gépköltség`.
    - Munkalap: `issuePart(p.id,q,wo.machine)`; costTo `munkalap <wo> → <machine>`.
    - Projekt or Egység: `p.qty-=q` and push `{t, ref, kind, cost:q*price, item, qty}` onto `S.projCost`; costTo `projektköltség` or `egység rezsije`.
    - Pushes onto qrlog `{t, mode:'Kiadás', item, code, qty:q, unit, to:'<kind>: <name>', tcode, cost:q*price, costTo}`. Toast `Kiadva: <q> <unit> → <name>`.
  - receive:
    - Needs p, loc and q>0, else toast `Cikk, mennyiség és raktárhely kell.`
    - `p.qty+=q`, `p.loc=loc.ref`. If a PO is set: `po.status='Beérkezett'`, `po.recvQty=q`.
    - qrlog entry with mode `Bevételezés`, to `Raktárhely: <name>`, costTo `rendelés <po>` or `rendelés nélkül`.
    - log `('Raktáros (QR)','Bevételezés <q> <unit> <name> → <loc>')`. Toast `Bevételezve.`
  - move:
    - Needs p and loc, else toast `Cikk és új raktárhely kell.`
    - `p.loc=loc.ref`. qrlog entry with mode `Áthelyezés`, qty = the whole p.qty, to `<from> → <to>`, cost 0, costTo `—`. Toast `Áthelyezve.`
  - count:
    - Needs p and q>=0, else toast `Cikk és mennyiség kell.`
    - `diff = q - p.qty`. qrlog entry with mode `Leltár`, to `<loc>: könyvi <qty>, eltérés <±diff>`, cost diff*price, costTo `leltáreltérés → jóváhagyás` or `egyezik`.
    - If diff: `approval('inv','QRCNT-'+p.id,'Leltáreltérés — <name>','QR-leltár: mért <q> / könyvi <qty> <unit>','Javaslat: a kiadási napló ellenőrzése az utolsó leltár óta, majd helyesbítés')`.
    - Toast `Eltérés: jóváhagyásra küldve.` or `Egyezik.` Book stock is not changed here.
  - On success: clears item, target, po and qty (loc too, except in count mode). msg `Kész. Következő cikk.` Renders. A failed validation returns before the reset, without rendering.
- `decodeQR(input)`: see the Device section. On success it calls `scanInput(code)`, renders, and toasts `QR beolvasva: <code>`. On failure the toast is `Nem találtam QR-kódot a képen.`
- `X.qsub(d)`: `QSUB=d.k` (`scan|labels|log|proj`), then renders.
- `X.qmode(d)`: resets SCAN with `mode=d.k`. The msg depends on the mode:
  - receive `Olvassa be a rendelés vagy a cikk QR-kódját.`
  - issue `Olvassa be a cikk QR-kódját.`
  - move `Olvassa be a cikket.`
  - count `Olvassa be a raktárhely QR-kódját.`
- `X.qscan(d)`: copies `#qr-qty` into SCAN.qty, sets `QSUB='scan'`, calls `scanInput(d.c)`, renders.
- `X.qreset()`: `X.qmode({k: SCAN.mode})`.
- `X.qcommit()`: copies qty, then calls `scanCommit()`.
- `decide()` wrapper (L1702):
  - `kind==='contract'`: if approved → `X.csend({id:refId})`. Sets status `Jóváhagyva` or `Elutasítva`, then renders.
  - `kind==='inv'` with refId starting `QRCNT-`: if approved, sets the part qty to the qty of the first qrlog `Leltár` entry for that item name (the latest one, since entries are unshifted) and logs `('Tulajdonos','Leltár-helyesbítés: <name>')`. Sets the status, then renders.
  - Anything else goes to the original decide.

### Navigation, counts (L1696–1701, L1769, L2004–2009)

- After L1697–1700 plus the L2005–2007 splices:
  - `NAV[0]` gets `['today','Ma (mobil)']` inserted at index 1.
  - `NAV[1]`: inbox `Ajánlatkérések` (badge inq), quotes `Árajánlatok`, contracts `Szerződések` (badge con), orders `Megrendelések`, portal `Vevői portál`.
  - `NAV[2]`: dispatch `Fuvarszervezés` (pend), transport `Fuvarok és EKÁER` (badge ek added at L2006), scale `Mérleg (rendszámfelismerés)` (inserted at index 2), driverapp `Sofőr app`, telem `Telematika (iTrack)`, dn `Szállítólevelek`, tig `Teljesítésigazolás` (tig), billing `Számlák`, integr `Integrációk` (jobs).
  - `NAV[3]`: stock `Termékkészlet`, store `Üzemi raktár`, qr `QR raktár`, then operapp `Gépkezelő app`, mechapp `Szerelő app` (badge mlog) and waste `Hulladéklerakó`, all three inserted at index 3; then machines `Gépek`.
  - `NAV[4]`: reports `Riportok és árazás`, payroll `Bérszámfejtés`.
- `counts()` additions:
  - `pend` = transports with status `Javasolt`
  - `tig` = TIGs with status `Aláírásra vár`
  - `con` = contracts with status `Kiküldve` or `Piszkozat`
  - `ek` = transports where `ekaer.prepared && !ekaer.number` and status ≠ `Törölve`
  - `mlog` = work orders with status `Hibajegy`

### EKÁER admin gate (L1755–1768)

- `ekaerSubmit(fid, silent, approved)` wrapper:
  - Returns if the transport is missing, `!ekaer.required`, or it already has a number.
  - If `!approved && mode('ekaer')!=='auto'`: on the first call it sets `ekaer.prepared=now`, `ekaer.status='Admin-jóváhagyásra vár'` and logs `('AI · EKÁER-ügyintéző','Bejelentés előkészítve, EKÁER-admin jóváhagyására vár', f.id)`. Then it returns without submitting.
  - Otherwise it clears `prepared` and calls the original submit.
- The ekaer agent's `does` text becomes `Fuvaronként eldönti a kötelezettséget és előkészíti a bejelentést; a beküldést az EKÁER-admin hagyja jóvá (csoportosan).`
- The PHASES EKÁER row becomes `[..., 'kötelezettség-döntés, bejelentés előkészítése, módosítás, lezárás', 'minden beküldés (EKÁER-admin, egy kattintással)']`.
- `X.eksel()`: checks every `.ekchk`.
- `X.eksend()`:
  - Collects the checked ids. If none: toast `Jelöljön ki legalább egy bejelentést.`
  - Otherwise calls `ekaerSubmit(id,true,true)` for each, logs `('EKÁER-admin (ember)','<n> EKÁER-bejelentés jóváhagyva és beküldve')`, renders, toast `<n> bejelentés beküldve.`

### Machine log, operator app (L1771–1800)

- `S.mlog=[]`, `SEQ.ML5=0`.
- `IDLE` reasons: `várakozás anyagra / autóra`, `meghibásodás`, `tervezett karbantartás`, `időjárás`, `egyéb`.
- `mlogAdd(e)`: sets `e.id = 'GN-'+pad4(++SEQ.ML5)` and unshifts it onto S.mlog. If the machine exists and `e.run` is set: `m.next = max(0, m.next - e.run)` (hours to service). Returns e.
- `lastHours(mid)`: `hEnd` of the latest mlog entry for that machine. Defaults: DOZ-01 6412, TOR-01 3184, OSZT-01 2920, RAK-01 8841, RAK-02 10220, RAK-03 12904, others 1000.
- `OPA={op:'E2', machine:'OSZT-01'}`. `XC['opa-op']` sets op, then renders. The `#opa-m` change listener (L2016) sets OPA.machine, then renders.
- `closeShift5()` (submit of `#opaform`):
  - `h1` = `#opa-h`. If `!(h1>h0)`: toast `Az óraállás nem lehet kisebb az előzőnél (<h0>).`
  - `span=h1-h0`, `idle = +#opa-idle || 0`.
  - Entry `{date: TODAY, machine, operator: op.name, src: (m.src==='szalagmérleg' ? 'szalagmérleg + kezelő' : m.src), hStart:h0, hEnd:h1, run:span, idle, idleReason: idle ? #opa-reason : '', fault: #opa-fault checked ? (#opa-ftext || 'hiba, leírás nélkül') : '', photo: OPAPHOTO, prod:null}`.
  - OSZT-01: `prod = {p4:420, p9:180, p10:260, p11:510}`, fixed values. For each: `move(TODAY, pid, P(pid).depot, t, 'gyártás', e.id||'GN')`. e.id is still undefined at that point, so the ref is `'GN'`.
  - TOR-01: if `#opa-feed` exists, `e.feed = +value`.
  - Then `mlogAdd(e)`, `OPAPHOTO=null`, log `('<op> (gépkezelő app)','Műszak lezárva: <m>, <span> üzemóra, <idle> h állás[ · HIBA]', e.id)`.
  - If there is a fault: `newJM(m.id,'Hibajegy: <fault>','Hibajegy',e.id)` and log `('AI · Karbantartás-tervező','Hibajegyből munkalap: <wo> (<m>); szerelő értesítve', wo.id)`.
  - Renders. Toast `Műszak lezárva, hibajegy a szerelőknek.` or `Műszak lezárva.`

### Work orders, mechanic app (L1802–1827)

- `SEQ.JM=86`.
- `newJM(mid,name,status,ref)`: `{id:'JM-2026-'+pad4(++SEQ.JM), machine:mid, name, due: TODAY, kit:[], hours:0, status: status||'Tervezett', mech:[], used:[], start:null, end:null, ref}`, unshifted onto `S.wos`. Returns it.
- `MCH={me:'E9', sel:null}`. `XC['mch-me']` sets me, then renders. `X.mchsel(d)` sets sel, then renders.
- `compatOK(p,mid)`: true if any `p.compat` entry matches `/minden/`, or compat includes mid, or compat includes `'tehergépkocsik'` and mid is a truck id.
- `X.jmstart(d)`: `start=now`, `mech=[me]`, `status='Folyamatban'`. If the id does not start with `JM`, then `w.jm=w.id`. Log `('<name> (szerelő app)','Munka megkezdve', w.id)`. Renders.
- `X.jmjoin(d)`: `w.mech.push(me)`, then renders.
- `X.jmpart(d)`:
  - Part from `#jm-part`, `q` from `#jm-q`. If `!(q>0) || q>p.qty`: toast `Nincs elég készlet.`
  - If the part is incompatible and `!w._ovr`: sets `w._ovr=true` and toasts `<part> nem kompatibilis a <machine> géppel. Újabb kattintás: kivét mégis.`, then returns. The flag persists per work order.
  - Otherwise: `issuePart(p.id,q,w.machine)` and push `{sid, name, q, unit, cost:q*price}` onto `w.used`.
  - qrlog entry `{mode:'Kiadás', code:'MP-CIKK-'+ID, to:'Munkalap: <wo> → <machine>', tcode:'MP-ML-'+w.id, cost, costTo:'munkalap <wo> → gépköltség'}`. Here tcode uses the full id, not `slice(3)`.
  - Renders.
- `X.jmclose(d)`:
  - `end=now`, `hours = +#jm-h || 1`, `done = #jm-done`.
  - `rate = 720000*1.13/168` Ft/h. `labor = hours * mech.length * rate`.
  - Pushes `S.issues.push({t, sid:'s4', qty:0, machine, cost:labor, labor:true})`.
  - If the WO name matches `/szerviz/`: `m.next = m.svcEvery`.
  - `status='Lezárva'`. Log `('<me name> (szerelő app)','Munkalap lezárva: <wo>, <h> h × <n> szerelő, alkatrész <Σcost>', wo.id)`.
  - `MCH.sel=null`, renders, toast `Munkalap lezárva, költség a gépen.`

### ANPR weighbridge (L1834–1859)

- `S.anpr=[]`, `S.loadWait=[]`, `SCALE={cur:null, q:0}`.
- `anprQueue()`: today's transports with status `Tervezett`, sorted by start, mapped to `{plate:truck, kind:'own', fid}`. It then inserts `{plate:'KZT-482', kind:'waste'}` at index 1 and `{plate:'ABC-123', kind:'unknown'}` at index 3.
- `X.scarrive()`:
  - `done` = the set of `plate+(fid||'')` over S.anpr. The next queue item not in done is taken. If there is none: toast `Nincs több mai érkező jármű.`
  - `wait = 8+((anpr.length*7)%19)`.
  - `conf` = 61 for unknown, otherwise `96+(anpr.length%4)`.
  - `gross`:
    - own: `+(tare+planned+((anpr.length%3)-1)*0.35).toFixed(2)`
    - waste: 36.4
    - unknown: 28.1
  - Sets `SCALE.cur = {...item, conf, gross, wait}`, then renders.
- Own-vehicle blocks:
  - `ekaer.required && !ekaer.number` → `EKÁER-szám hiányzik — az EKÁER-admin jóváhagyására vár`
  - `net > cap*1.02` → `túltöltés: <net> t > <cap> t teherbírás — vissza a rakodóhoz`
  - Here `net = +(gross - t.tare).toFixed(2)`.
- `X.scok()`: `closeTransport(f.id, net, 0)`, then push `{t, min:wait, truck}` onto S.loadWait. Unshifts onto anpr `{t:HH:MM, plate, conf, fid, match:'<fid> · <client>', net, wait, done:true}`. Log `('Mérleg (automatikus)','Rendszám <plate> → <fid>; nettó <net> t → szállítólevél', fid)`. Clears cur, renders.
- `X.scnext()`: unshifts onto anpr `{t, plate, conf, fid, match: fid||'', exc: kind==='unknown' ? 'ismeretlen rendszám' : 'félreállítva'}`. Clears cur, renders.
- `X.scfix()`:
  - `p = upper(trim(#sc-plate))`. It looks for a transport today with `truck===p` and status `Tervezett`. If none: toast `Ehhez a rendszámhoz nincs mai elfogadott fuvar.`
  - Otherwise `cur = {plate:p, kind:'own', fid, conf:100, gross:+(tare+planned).toFixed(2), wait: previous wait}`, log `('Mérlegkezelő (ember)','Rendszám kézzel javítva: <p>')`, renders.
- `X.sctowaste()`: `WASTE.pre = {plate, gross}`. Unshifts onto anpr `{t, plate, conf, match:'hulladék-beszállítás', done:false}`. Clears cur, sets `WASTE.tab='new'`, calls `go('waste')`.

### Waste landfill (L1861–1887, form handling at L2017–2023)

- `S.wcodes` (code, name, Ft/t, permitted):
  - `17 05 04` `Föld és kövek (nem veszélyes)` 2400 ok
  - `17 01 07` `Beton, tégla, cserép keveréke` 3600 ok
  - `17 01 01` `Beton` 3100 ok
  - `17 09 04` `Kevert építési-bontási hulladék` 0 not permitted
- `S.wpart`:
  - W1 `Fejér-Bontó Kft.`, kuj `[KÜJ a felmérésből]`, ktj `[KTJ a felmérésből]`, plates KZT-482 and KZT-519, codes 17 05 04 and 17 01 07.
  - W2 `V-Híd Építő Zrt.`, `[KÜJ]`/`[KTJ]`, VHD-114, codes 17 05 04 and 17 01 01.
  - W3 `Polgárdi Önkormányzat`, POL-001, code 17 05 04.
- `S.wlog=[]`, `SEQ.HL=40`, `S.wpolicy={tax:0}`.
- `wasteAdd(e)`: `id = 'HL-2026-'+pad4(++SEQ.HL)`, `fee = net*code.price`, `taxFee = net*S.wpolicy.tax`. Unshifts onto wlog and returns e.
- `WASTE={tab:'list', pre:null}`. `X.wtab(d)` sets the tab. `XC.wtax(t)`: `S.wpolicy.tax=+value`, then renders. The tax applies only to later entries.
- `#wform` submit:
  - If the code is not permitted (`!c.ok`): toast `A <code> kód nem szerepel a fogadási engedélyben — a beszállítás nem fogadható.` and log `('Hulladék-nyilvántartó (AI)','Elutasítva: <code> (<partner>) — engedélyen kívüli kód')`. Nothing is recorded.
  - If the code is not in the partner contract: toast `<partner> szerződésében nincs <code>; rögzítve, de jóváhagyásra küldve.` and `approval('inv','W-'+code,'Hulladék szerződésen kívüli kóddal — <partner>','<code> nincs a partner szerződésében','Javaslat: szerződésmódosítás vagy eseti díj')`. The entry is still recorded.
  - Records `wasteAdd({date: TODAY, partner, plate: upper(#w-plate), code, gross, tare, net:+(g-t).toFixed(2), doc:#w-doc, photo:WPHOTO})`, then `WPHOTO=null`, `WASTE.pre=null`.
  - The first anpr row with the same plate and `!done` gets `done=true`, `net`, `match='<HL id> · hulladék'`.
  - Log `('Hulladéklerakó (ember)','Beszállítás: <partner>, <code>, <net> t', id)`. `tab='list'`, renders, toast `Rögzítve.` The last toast overrides the contract-mismatch toast.
- `X.winv(d)` (monthly invoice per partner):
  - Uninvoiced entries are grouped by code. Items: `{name:'Hulladékátvétel <code> — <name>', unit_price: price, unit_price_type:'net', quantity: +t.toFixed(2), unit:'t', vat:'27%'}`.
  - `net = Σ price*qty`. The waste tax is not included in the invoice items.
  - Doc: `{kind:'Gyűjtőszámla (havi)', ref:'hulladéklerakó, <n> beszállítás', order:'—', clientName: partner, amount: net, gross: net*1.27, due: TODAY+15, status:'Sorban (Billingo)', nav:'—', payload:{type:'invoice', items}}`.
  - The job sets number `MP-2026-<++SEQ.SZ>` and nav `Befogadva`.
  - Each entry gets `w.inv = doc.id`. Log `('AI · Számlázó','Hulladéklerakó gyűjtőszámla: <partner>, <net Ft> nettó')`, toast `Számla kiállítva.`
- Registers agents `{id:'waste', name:'Hulladék-nyilvántartó', does:'A mérlegből és a kísérő dokumentumból rögzíti a beszállítást, ellenőrzi a fogadási engedélyt, havi nyilvántartást és számlát készít.', mode:'suggest'}` and `{id:'invoicein', name:'Bejövőszámla-olvasó', does:'Kiolvassa a szállítói számlát, gépet vagy munkalapot javasol; gépazonosító nélkül nem enged könyvelést.', mode:'suggest'}`.
- Adds 4 rows to PHASES (L2009):
  - `['Mérlegelés','Mérleg (automatikus)','rendszám → fuvar → nettó tömeg → szállítólevél','ismeretlen rendszám, túltöltés, hiányzó EKÁER']`
  - `['Gépüzemnapló, szerviz','Karbantartás-tervező','műszakzárásból üzemóra, állásidő, hibajegy → munkalap','munkalap lezárása (szerelő)']`
  - `['Hulladéklerakó','Hulladék-nyilvántartó','beszállítás, engedély-ellenőrzés, nyilvántartás, számla','nem engedélyezett kód']`
  - `['Bejövő számla','Bejövőszámla-olvasó','kiolvasás, gép/munkalap-javaslat, 3-utas egyeztetés','költséghely elfogadása, fizetés']`

### RFID refuelling, fuel-card import (L1909–1920)

- `S.fuelLog=[]`.
- `rfidFill(mid,l,silent)`:
  - `tag='RFID-'+mid`. Calls `issuePart('s1', l, mid)`, where s1 is the diesel part. The ternary in the call resolves to `mid` in every case.
  - Unshifts `{t:HH:MM, tag, m:mid, l, cost: l*S.diesel}` onto fuelLog.
  - Unless silent: log `('Kút (RFID, automatikus)','<mid> → <l> l')`.
- `#rfidform` submit (L2024): if `!(l>0)` it returns silently. Otherwise `rfidFill(m,l)`, renders, toast `<m>: <l> l, költség a gépen.`
- `X.cardimp()`: sets `S.cardImp` (cost = l×Ft/l):
  - `{truck:'SMP-118', where:'MOL Székesfehérvár', l:260, cost:260*612, it:180, ok:false}`
  - `{truck:'MPK-103', where:'Shell Polgárdi', l:310, cost:310*609, it:308, ok:true}`
  - `{truck:'RKX-530', where:'OMV Siófok', l:290, cost:290*615, it:291, ok:true}`
  - Log `('Pénzügy (import)','Üzemanyagkártya-export betöltve: 3 tankolás, 1 eltérés')`, renders. The data is not booked to costs.

### Direct order from an inquiry, PDF/Excel intake (L1922–1940)

- `parseInquiry` wrapper: it adds `r.project` = capture of `/projekt\s*[:\-–]?\s*([^\n;]{3,60})/i` trimmed, otherwise `''`.
- `inqDetail` wrapper:
  - If `ex.project`: inserts the row `Projekt | <b>project</b>` before `Tételek`.
  - If `ex.lines` is non-empty, `ex.clientId` is set and there is no `directOrder`: adds the button `Közvetlen megrendelés (ajánlat nélkül)` (`data-x="direct"`) at the start of the first `<div class="row" style="margin-top:8px">`.
  - If `directOrder` is set: inserts the alert `Közvetlen megrendelés: <id>` before the first `<div class="aibox">`.
- `X.direct(d)`:
  - Prices with `pr = priceEngine({clientId, lines, zip})`.
  - Creates the quote `{id:'A-2026-<n>', inq, clientId, clientName, zip, city, addr, date: ex.date||TODAY+2, pr, created, valid: TODAY+14, status:'Kiküldve', direct:true}`, unshifted.
  - `o = quoteToOrder(q.id)`, `o.project = ex.project||''`, `q.status='Megrendelve'`.
  - On the inquiry: `inq.status='Közvetlen megrendelés'`, `inq.directOrder=o.id`.
  - Pending approvals with `refId===inq.quoteId` are set to `Elutasítva`. The old quote `inq.quoteId`, if it has no orderId, gets status `Felülírva`.
  - Log `('Vevőkezelés (ember)','Közvetlen megrendelés ajánlat nélkül: <o>[ · projekt: <p>]', o.id)`. Renders. Toast `Megrendelés: <o>; szerződés és fuvarjavaslat indul.`
- The PDF/XLSX upload on `#em-file` is covered in the Device section. Afterwards it creates the inquiry `{id:'INQ-'+(++SEQ.INQ), channel:'E-mail csatolmány (PDF)'|'E-mail csatolmány (Excel)', from: #em-from, name:'', subject: filename, received: now, status:'Új', raw: txt.slice(0,8000)}` (unshifted), runs `processInquiry(inq)`, sets `sel.inq`, renders, and toasts `Beolvasva: <filename>`.
- `V.inbox` wrapper:
  - Changes the file input accept from `.txt,.eml,.csv,text/plain` to `.txt,.eml,.csv,.pdf,.xlsx,.xls,text/plain,application/pdf`.
  - Changes the label `Fájl beolvasása (.txt, .eml, .csv)` to `Fájl beolvasása (PDF, Excel, .eml, .txt)`.
  - Changes the sample email text so that `Projekt: M0 Gyál lehajtó, 2. ütem` is inserted before `Köszönöm, V-Híd Építő Zrt.`

### Capacity plan, "Napi tonnacél" (L1942–1964)

- `CAP = {target:600, oid:null, zip:'8000', pid:'p11', date: iso(TODAY+3)}`.
- `capacityPlan(target, zip, pid, date)`. The `pid` parameter is unused.
  - `d = date T09:00`. `rules = addrRules({zip, city:'', addr:''})`. `km = distKm(zip)`.
  - Cycle time `cyc = 0.58 + km/52 + km/58` h. Driving time `drv = km/52 + km/58` h.
  - Eligible trucks:
    - Exclude `t.mot < date` (string comparison).
    - Exclude trucks that violate any rule: `maxGross && parseFloat(t.gross) > maxGross`; `needPermit && !/budapest/i.test(t.permit)`; `euro && t.euro !== r.euro`; `tip && t.tip !== r.tip`.
    - `free = max(0, 18 - max(6, truckDay(t.id,d).end))`. Keep only `free > cyc`.
    - Sort by cap descending, then `truckFtKm` ascending.
  - For each truck while `left > 0.1`, pick a driver:
    - Exclude drivers already used, `isLeave(q,d)`, `avail==='Betegszabadság'`, and `lic==='C'` with a truck type other than `'4 tengelyes billencs'`.
    - Require `driverDay.drive + drv <= 9`.
    - Sort by `dd.work` ascending, then eco descending, and take the first. If none, skip the truck.
  - `trips = min(floor(free/cyc), floor((9-drive)/drv), ceil(left/cap))`. If below 1, skip. `tons = min(left, trips*cap)`.
  - Push `{t, d, trips, tons}`, subtract tons from `left`, mark the driver as used.
  - Returns `{rows, left: max(0,left), km, cyc, trucks: eligibleCount}`.
- Change handlers: `XC.capo` (oid or null), `XC.capd` (date), `XC.capt` (`+target`) and `XC.capz` (zip). Each renders.
- `X.capmake()`:
  - Recomputes the plan with `o.zip` and `pid = o.lines[0].pid`.
  - For each row and trip i: `t = min(cap, tons - i*cap)`. Break if `t<=0.1`.
  - Creates the transport `{id:'F-2026-<n>', order, clientId, clientName, pid, planned:t, truck:null, driver:'', driverId:null, date:d, prefStart:6, status:'Javasolt', net:null, depot: P(pid).depot, ekaer: ekaerCheck(o,pid,t), km: distKm(zip)}`, unshifted.
  - `o.planned[pid] += t`, then `assign(f, truck, driver)`.
  - Log `('AI · Fuvarszervező','Tonnacélból <n> fuvarjavaslat: <o>, <date>', o.id)`. `DISP.tab='day'`, `DISP.date=d`, renders, toast `<n> fuvar javasolva.`

### Daily material balance, report `R.mb` (L1966–1976)

- `MBD = iso(TODAY)`. `XC.mbd` sets it, then renders.
- Per product:
  - `o` = Σ stockMoves before day d.
  - `prod` = Σ moves on d with type `/gyártás|beszerzés/`.
  - `sold` = Σ moves on d with type `/eladás/` (negative quantities).
  - `oth` = Σ moves on d with type `/átszállítás|helyesbítés|saját/`.
  - `c = o+prod+sold+oth`.
- `feed` = Σ `inT` of the shifts on d.
- `out` = Σ prod − Σ prod of products with `src==='buy'`.
- `osztOut` = Σ of the mlog `prod` values on d.
- Loss = `max(0, feed - out + osztOut)`.
- `V.reports` wrapper adds the tab button `Anyagmérleg` (`data-rep="mb"`, aria-selected when `sub.reports==='mb'`) after `Terv–tény`.

### Owner "Ma" summary (L1978–2002)

- `todaySummary()` (`cm = costModel()`). `tr` = today's transports that are not `Törölve` or `Javasolt`. `done` = the `Lezárva` ones.
  - `tons` = Σ net.
  - `rev` = Σ `net*(line.unitNet + (o.freightPerT||0))`.
  - `cost` = Σ `net*cm.unit[pid] + (km||0)*2*cm.ftPerKm`. `margin = rev - cost`.
  - `feed` = Σ shift `inT` today.
  - `prodByM`: per first word of the shift recipe, Σ `out[].t`, plus the mlog `prod` totals per machine.
  - `working` = distinct trucks in tr. `trucks` = S.trucks.length. `trips = tr.length`, `tripsDone = done.length`.
  - `loadWait` = average `S.loadWait.min` today, or null. `dropWait` = average `f.wait` over done with wait, or null.
  - `fuel` = Σ `S.fuelLog.l`. This is all entries, not filtered by date.
  - `idle` = Σ mlog idle today. `idleWhy` = `'<m>: <idle> h (<reason>)'`. `faults` = `'<m>: <fault>'`.
  - `service` = work orders not `Lezárva` and (status ≠ `Tervezett` OR due <= today), formatted `'<m> (<id>, <status lower>)'`.
  - `ar` = Σ gross of invoices that are unpaid, not Sztornó and have a number. `overdue` = the same with `due < TODAY`.
  - `stock` = `{name, t: stockOf(id)}`. `cust` = the top 4 of `custProfit()` as `{name, pct: margin/rev}`. `mach` = non-fuvar `cm.mach` as `{id, perH}`.
- `erpTools` wrapper adds two tools:
  - `mai_nap`, description `A mai nap összefoglalója: kitermelés, termelés gépenként, kiszállított tonna, árbevétel, fedezet, autók, várakozás, gépállás okokkal, hibák, szerviz, kintlévőség.` It returns todaySummary without stock and cust.
  - `gepnaplo`, description `Gépüzemnapló az elmúlt napokra: gép, kezelő, üzemóra, állásidő és oka, hiba, termelés frakciónként; összevetve a tervvel (OSZT-01 terv: 1500 t/műszak, TOR-01 terv: 220 t/óra).` It returns the first 20 mlog rows as `{nap, gep, uzem, allas, ok, hiba, termeles, feladas}`.
- `X.ask` wrapper: remembers `route`, awaits the original. If the route was `today` and changed, it calls `go('today')`.
- `X.askq` wrapper: sets `S.ask.q = d.q`. If route is `today` it calls `X.ask5(d.q)`, otherwise the original.
- `X.ask5(q)`:
  - No-op if `!SAMPLE`.
  - Sets `S.ask={q, a:'', busy:true}`, then renders.
  - Calls `SAMPLE(prompt, {tools: erpTools(), onText: ({text}) => S.ask.a = text})` with the prompt `Te a Mészkő-Polgár Kft. ERP-rendszerének AI-asszisztense vagy. A tulajdonos kérdésére válaszolj magyarul, legfeljebb 6 rövid mondatban, konkrét számokkal; csak az eszközök adataira támaszkodj, és ha valami nem derül ki, mondd meg. Zárd egy javasolt teendővel.\n\nKérdés: <q>`.
  - On error: `S.ask.a = e.text || 'A válasz nem érkezett meg.'`. Finally `busy=false`, renders.

### Timeline drag (L1724–1734)

- `bindTimeline()`: binds once on `svg#tl` (`svg._b` flag). It reads `data-w`, `data-lw`, `data-h0` and `data-rh` from the svg.
  - pointerdown on a `g[data-id]`: the transport must exist and not be `Lezárva`. Sets `drag = {g, f, p0, moved:false}` and pointer capture.
  - pointermove: `moved=true` once `|dx|+|dy| > 5` (viewBox units). Sets `transform=translate(dx,dy)` on the group.
  - pointerup without movement: nothing happens, so the click passes through. With movement:
    - `row = floor((y-H0)/rh)`.
    - `hour = round((f.start||6 + dx/((W-lw-10)/14))*4)/4`, which snaps to 15 minutes.
    - Rows are truck ids if `DISP.rows==='truck'`, otherwise driver ids. The key is clamped to a valid row.
    - Truck mode: `tId = key` and the driver stays (`f.driverId||first`). Driver mode: the truck stays (`f.truck||first`) and `dId = key`.
    - `ev = assign(f, tId, dId, 'Diszpécser (húzással)', clamp(hour,5,18))`. `DISP.sel=f.id`. Renders.
    - Toast `Áthelyezve, de szabályt sért: <ev.hard[0]>` if ev.hard is non-empty, otherwise `Áthelyezve: <tId> · <fmtH(start)>`.

### Seed extensions

- `SIG_SVG(n)`: a data-URI SVG (260×70) with a fixed signature path (stroke `#1d3a6e`, width 2.4) and the name as 9px text in `#555`.
- `seed` wrapper #4 (L1705–1719), after the original seed:
  1. Order `vh` = the order whose quote is `A-2026-81`. Its contract gets `created=TODAY-6` and `signContract(cv,'e','Dr. Fekete Ildikó beszerzési igazgató', SIG_SVG('Dr. Fekete Ildikó'))`.
  2. The first 2 `Lezárva` transports of vh get a POD `{name:'Kovács Ferenc építésvezető', t: f.date, img: SIG_SVG('Kovács F.'), how:'e-aláírás a sofőr tabletjén', gps:'iTrack: lerakó POI'}`, `wait` [55,25], and the POD copied to the dn.
  3. `autoAssignDay(TODAY,true,true)`. Every `Javasolt` transport of vh today goes through `acceptTrip(f,'Diszpécser (ember)')`.
  4. The earliest `Tervezett` vh transport today is closed with `closeTransport(id, 24.8, 0)`.
  5. `createTIG(vh.id,'Napi TIG (keretszerződés, október 1–3.)')`.
  6. The pending quote approval for c2 with 2 lines is approved through the original decide.
  7. Helper `mk(qid,date,sign)`: `q.status='Kiküldve'` → `quoteToOrder` → `o.date=date T08:00` → optional `signContract` → `planTransports`. It is applied to:
     - the 2-line c2 quote, on 2026-10-06, not signed;
     - the 1-line c2 quote with qty 75, on 2026-10-07, signed `Tóth Gábor ügyvezető`;
     - `A-2026-79`, on 2026-10-07, signed `Horváth Ádám ügyvezető`.
  8. qrlog seed, two rows dated TODAY-1:
     - Kiadás `Hidraulikaolaj HV46`, MP-CIKK-S3, 40 l → `Gép: TOR-01 Sandvik QI440 röpítőtörő` (MP-GEP-TOR-01), 58000, `gépköltség`.
     - Bevételezés `Kenőzsír EP2`, MP-CIKK-S5, 50 kg → `Raktárhely: Műhely raktár A/2 polc`, 95000, `rendelés PO-2026-17`.
  9. `itrackSync(); buildTelemStats();` then the audit log is sorted descending by time.
- `seed` wrapper #5 (L2027–2038):
  - Yesterday's mlog entries:
    - DOZ-01, Kovács Imre, `kezelői jelentés`, 6403.2→6412, idle 0.4, `várakozás anyagra / autóra`
    - TOR-01, Pap József, `kezelői + rakodómérleg`, 3175.1→3184, idle 0.9, `meghibásodás`, feed 1640
    - RAK-01, Simon Dávid, `kezelői + kanálmérleg`, 8832.3→8841, idle 0.3, `várakozás anyagra / autóra`
    - OSZT-01, Lakatos Ernő, `szalagmérleg + kezelő`, 2910.6→2920, run 9.4, idle 0.6, prod `{p4:420, p9:180, p10:260, p11:510}`, also posted as stock moves `gyártás` with ref = mlog id
  - Today's entry: DOZ-01, Kovács Imre, 6412→6417.5, run 5.5, idle 2.1, `meghibásodás`, fault `hidraulika szivárog a bal emelőhengernél`.
  - `newJM('DOZ-01','Hibajegy: hidraulika szivárog a bal emelőhengernél','Hibajegy','GN-0006')`. By the sequence above this entry is GN-0005, so the ref `GN-0006` does not match it.
  - Silent RFID fills: RAK-01 237, TOR-01 410, DOZ-01 198, RAK-02 205.
  - `S.loadWait.push({t: TODAY, min:12, truck:'RKX-412'})` and `S.anpr.push({t:'06:41', plate:'RKX-412', conf:98, fid:'', match:'V-Híd · 1. forduló', net:24.8, wait:12, done:true})`.
  - Waste entries (partner, plate, code, gross, tare, doc, day offset):
    - W1 KZT-482 17 05 04 36.2/14.2 SZJ-2026-091 −2
    - W1 KZT-519 17 01 07 31.5/14.0 SZJ-2026-092 −2
    - W2 VHD-114 17 05 04 33.9/14.6 SZJ-2026-094 −1
    - W3 POL-001 17 05 04 18.4/9.1 SZJ-2026-095 −1
    - W1 KZT-482 17 01 07 35.0/14.2 SZJ-2026-096 0
  - `AE.mode='suggest'`. The first 6 transports with `ekaer.required && !number && truck` and status not `Lezárva`/`Törölve` go through `ekaerSubmit(id,true)`, which only prepares them. The audit log is then sorted.

---

## Screens / panels / modals in range

There are no modals. Every screen is a `V.<route>` render with `head(title, subtitle, rightControl?)`.

### Sofőr app (`driverapp`), POD part

See the business rules. The phone frame is `.phone`. The header control is `Sofőr` select (`data-xc="drv"`).

### Szerződések (`contracts`)

- Head: `Szerződések` · `Sablonból készülő szerződés, elektronikus vagy fotós aláírás, iktatás hash-értékkel.`
- Tabs (`data-x="csub"`): `Szerződések` | `Sablon` | `Iktatókönyv`.
- `list` tab:
  - Table columns `Szerződés | Vevő · megrendelés | Kiküldve | Állapot`. Rows are clickable (`copen`). The Állapot cell shows the pill and the registry number `c.ik`. Empty: `Még nincs szerződés.`
  - Note text: `Elfogadott ajánlatból a Szerződéskészítő automatikusan elkészíti a szerződést a sablonból, kiküldi a vevői portálra, figyeli az aláírást. Házirend: aláírt szerződés nélkül a diszpécser csak kivételként (naplózva) fogadhat el fuvart.`
  - Right panel: id and pill, `<pre class="doc">contractText(cur)</pre>`. If signed: `Aláírta: <signer> · <signed hu-HU>` and the image.
  - Buttons:
    - `Piszkozat`: `Kiküldés aláírásra` (csend).
    - `Kiküldve`: `Megnyitás vevőként (portál)` (cportal), a file label `Aláírt példány feltöltése` (`accept="image/*,.pdf"`, `data-photo="contract"`) and `Emlékeztető` (cremind).
  - `Előzmények`: lines `<MM.DD HH:MM> · <actor> — <text>`.
- `tpl` tab:
  - `Szerződéssablon` with placeholder chips `{{szerzodesszam}} {{ajanlatszam}} {{megrendelesszam}} {{vevo_nev}} {{vevo_cim}} {{vevo_adoszam}} {{szallitasi_cim}} {{tetelek}} {{fuvar}} {{osszeg_netto}} {{osszeg_brutto}} {{teljesitesi_idoszak}} {{fizetesi_hatarido}} {{datum}}`.
  - Text: `A módosítás az új szerződésekre vonatkozik; a már kiküldöttek nem változnak.`
  - Textarea `#tpl-t` (24 rows) and button `Sablon mentése`.
- `reg` tab: `Iktatókönyv` with the text `Minden aláírt szerződés, TIG és aláírt szállítólevél-fotó iktatószámot és SHA-256 lenyomatot kap; utólagos módosítás a lenyomat eltéréséből kiderül.`
  - Columns `Iktatószám | Dátum | Típus | Tárgy | Beküldő | SHA-256`. Empty: `Üres.`

### Teljesítésigazolás (`tig`)

- Head subtitle: `Minden teljesített megrendelésből (vagy elszámolási időszakból) TIG készül. A vevő átvételkor a sofőr tabletjén, a vevői portálon elektronikusan, vagy aláírt papír fotójával fogadja el; elfogadás után automatikusan indul a számla.`
- Left side:
  - Table `TIG | Vevő · megrendelés | Időszak | Forduló | Állapot` (rows `topen`). Empty: `Nincs TIG.`
  - Section `TIG-re váró lezárt fordulók`: one alert per order with `Lezárva` transports that have no TIG, showing `<order> · <client>: <n> forduló` and the button `TIG készítése` (tmake). Empty: `Nincs.`
- Right side:
  - `Megrendelő: <b>client</b> · megrendelés <id> · elszámolási időszak <from> – <to>`.
  - Lines table `Nap | Fuvar | Szállítólevél | Rendszám | Termék | Nettó t | Nettó Ft | Átvétel`. The tfoot has `Termék` (tons, prod), `Fuvardíj`, `Állásidő` (only if wait) and `Nettó összesen`.
  - If signed: `Elfogadta: <signer> · <signedAt> · <ik>` and the image.
  - If `Aláírásra vár`:
    - Input `Aláíró neve` (`#ts-n`; default `Kovács Ferenc építésvezető` for c1, otherwise `Vevő képviselője`).
    - Pad `ts-sig` labelled `Aláírás (vevő, portálon vagy helyszínen)`.
    - Buttons `Teljesítés elfogadása` (tsign), a file label `Aláírt TIG fotója` (`data-photo="tig"`, camera capture) and `Vevői kifogás rögzítése` (tobj, styled bad).
  - Objection aibox: `Teljesítésigazoló · kifogás kezelése`.
  - `Előzmények`.

### Vevői portál, injected block

- Panel `Aláírásra vár` (border `--ai`).
- For each contract, an open `<details>` with the summary `<id> — szerződés (<order>)` and the contract text. Contents:
  - Input `Aláíró neve, beosztása` (`#cs-n-<id>`; default `Dr. Fekete Ildikó beszerzési igazgató` for c1, otherwise `Képviselő`).
  - Pad labelled `Aláírás`.
  - Checkbox `A szerződést elolvastam, a cég nevében aláírásra jogosult vagyok.`
  - Button `Szerződés aláírása` (pcsign) and a file label `Aláírt példány feltöltése` (`image/*,.pdf`).
- For each TIG, a `<details>` with the summary `<id> — teljesítésigazolás, <n> forduló, <tons>, nettó <total>`, the text `Részletek a TIG menüben; itt a vevő elfogadja.` and the button `TIG megnyitása és aláírása` (topen2).

### Telematika (iTrack) (`telem`)

- Head: `Telematika (iTrack)`. Subtitle: `iTrack WebService (REST API) integráció: pozíció, útvonal, események, mérőcsatornák (üzemanyagszint, km-óra), detektált tankolások, POI. Az adatokból tartja karban a rendszer a járművek és sofőrök paramétereit, és ebből számolja az állásidőt és a fogyasztást.`
- Right button: `Szinkron most` (`data-x="itsync"`). No `X.itsync` is defined in this range.
- `Térkép` panel:
  - Note `Sematikus alaptérkép a demóban; élesben OpenStreetMap-csempe (Leaflet)`, then `mapSVG`.
  - Vehicle table `Jármű | Hely | km/h | Üzemanyag | Km-óra | Frissítve`. The fuel pill is bad below 25 % and warn below 40 %.
- `Útvonal-visszajátszás`:
  - Select (`data-xc="tsel"`) with the placeholder `Válasszon fordulót…`. Options read `<fid> · <truck> · <date> · <from> → <to>`.
  - When a trip is selected:
    - `Megtett út`
    - `Fogyasztás (rakottan oda, üresen vissza)` as `<l> l · <l/km*100> l/100 km`
    - `Tartózkodás a lerakó POI-ján` as `<stopMin> perc → állásidő <max(0,stopMin-30)> perc`
    - `Max. sebesség`
    - `Alapjárat`
    - The "Élesben…" explanation text.
- `Tankolás-ellenőrzés`: text `iTrack detektált tankolás (üzemanyagszint-ugrás) vs. ERP-kiadás / üzemanyagkártya.`
  - Columns `Idő | Jármű | Hol | iTrack l | Számla/kiadás l | (pill)`. The pill is `egyezik` or `<erp-l> l eltérés`.
- `Járművenként (szept. 1 – okt. 3.)`: `Jármű | km | Üzemóra | l/100 km | Tankolt vs. fogyasztott | Alapjárat | Gyorshajtás`. The diff pill is bad when `diff/fuelL > 0.03`.
- `Sofőrönként`: `Sofőr | km | Vezetés h | l/100 km | Gyorshajtás | Hirtelen fék. | Eco-pont`. The eco pill is ok at 85 or more and warn below 75.
  - Note: `Az eco-pont a fuvarszervezés költség-pontszámába és a bérszámfejtés eco-prémiumába is bekerül.`
- `Események`: alert dots are bad for `/Gyors|fék/`, ok for `/POI/`, otherwise warn.
  - Fixed aibox `Pénzügyi elemző · telematika`: `Az SMP-118 tankolt mennyisége 7%-kal több a fogyasztottnál, és október 2-án a kártyás tankolásnál 80 l a számla és az iTrack közti eltérés. Javaslat: a kártyás tankolás bizonylatának bekérése Varga Lászlótól, a kártya napi limitjének 200 l-re csökkentése.`
- `Mit ad az iTrack API, mire használjuk`: a static table with 8 rows (data, ERP use, frequency):
  - Járművek listája / rendszám-párosítás a járműtörzzsel / naponta
  - Utolsó érvényes pozíció, aktuális sebesség / térkép, „hol az autó” a diszpécsernek és a vevői portálon (ETA) / 1–2 percenként
  - Pozíciók intervallumra / útvonal-visszajátszás, kifogáskezelés, km-alapú költség / forduló lezárásakor
  - Útvonalak intervallumra / km, menetidő, üzemóra járművenként, sofőrönként; bérszámfejtés menetideje / óránként
  - Események intervallumra / gyorshajtás, hirtelen fékezés, alapjárat → eco-pont; POI-érkezés/-távozás → állásidő / óránként
  - Mérőcsatornák aktuális értéke / üzemanyagszint, km-óra → szervizig hátralévő km, tankolási figyelmeztetés / 15 percenként
  - Detektált tankolások / összevetés kúti kiadással és kártyás számlával (üzemanyag-ellenőrzés) / naponta
  - POI és POI-csoport létrehozása, módosítása / minden szállítási címre és bányára automatikus POI (geokerítés) / új címnél

### Szállítólevelek (`dn`)

- Head subtitle: `Szállítólevél minden lezárt mérlegelésből automatikusan (Billingo). Átvételkor a vevő a sofőr tabletjén aláírja vagy a sofőr lefotózza a papírt. Innen indul a TIG és a számla.`
- 4 KPIs: `Úton / átvételre vár`, `Átvéve, számlázatlan`, `Számlázva` and `Átvétel nélkül 24 h után` (warn colour if above 0).
- Filter row:
  - Search input (placeholder `Keresés: szám, fuvar, megrendelés`, `data-xc="dnq"`).
  - Status select `Minden állapot` plus the 5 states (`dnst`).
  - Client select `Minden vevő` (`dncl`).
  - File label `Külsős szállítólevél (fotó)` (`data-photo="extdn"`, camera).
- Table `Szám | Kelt | Vevő | Fuvar · jármű | Termék | Nettó t | EKÁER | Átvétel | TIG · számla | Állapot`. Rows are `dnopen`. Empty: `Nincs találat.`
- Detail panel: the dnDoc sheet. Buttons:
  - `Újraküldés e-mailben` (always shown).
  - If the state is not `Számlázva` and the status is not Sztornó: `Tömeg-korrekció` and `Sztornó`.
  - Flow chips `Mérlegjegy→Szállítólevél→Átvétel→TIG→Számla`, each lit when its step is reached.
- `Ellenőrzések`:
  - bad alert `<fid>: lezárt fuvar szállítólevél nélkül (Billingo-sorban?)`
  - warn alert `<number>: 24 óránál régebbi, átvételi aláírás nélkül — a sofőr töltse fel a papír fotóját`
  - Empty: `Minden rendben.` (shown only when the unsigned list is empty).
- `Havi összesítő vevőnként`: `<client> | <n> db | <tons>`.
- `Külsős szállítólevelek`: text `Partnertől beszerzett áru (pl. mosott homok) szállítólevele fotóval; a bevételezéshez és a 3-utas számlaegyeztetéshez kapcsolódik.` Rows show a 60px thumbnail, the name and the date. Empty: `Még nincs.`

### Számlák (`billing`)

- Head subtitle: `Kimenő és bejövő számlák, számlázási sor, kintlévőség és behajtás egy helyen. A kimenő számla a Billingón keresztül készül, csak elfogadott TIG-ből.`
- Tabs (`invtab`): `Kimenő számlák` | `Számlázási sor` | `Kintlévőség, behajtás` | `Bejövő számlák` | `Beállítások`.
- `out` tab:
  - KPIs:
    - `Kiállított, nyitott`: unpaid, not Sztornó, has a number.
    - `Lejárt`: bad colour.
    - `Jóváhagyásra vár`: count, ai colour.
    - `NAV-ra beküldve`: `<Befogadva count> / <numbered count>`.
  - Filters: search (`Keresés: szám, vevő, megrendelés`), type select `Minden típus` + [`Számla (TIG alapján)`, `Gyűjtőszámla (havi)`, `Előlegszámla`, `Díjbekérő`, `Helyesbítő számla`, `Sztornó`], and the button `Előlegszámla / díjbekérő` (newadv).
  - Table `Szám | Típus | Vevő | Bruttó | Esedékes | NAV | Fizetés`. Rows use `data-doc`. The Fizetés pill is Sztornó, Kiegyenlítve, Lejárt or the status.
  - Detail: the `SZÁMLA` docsheet with seller `Mészkő-Polgár Kft. 12312312-2-07`, buyer, `Teljesítés`/`Esedékes`, an items table and the tfoot `Nettó / ÁFA 27% / Bruttó`. `Kapcsolódó: <ref> · TIG: <ids>`.
  - Buttons:
    - `Jóváhagyom, kiállítás a Billingóban` (`data-issue`), only if `Jóváhagyásra vár`.
    - If numbered, not Sztornó and unpaid: `Helyesbítő számla` (corrinv), `Sztornó` (`data-storno`) and `Kiegyenlítés rögzítése` (markpaid).
  - `<details>` `Billingo API kérés` with the JSON payload.
- `queue` tab: `Számlázási sor`, text `Számla csak elfogadott TIG-ből készül. A TIG-re váró fordulók a Teljesítésigazolás menüben kezelhetők.`
  - Columns `Megrendelés | Vevő | Számlázható forduló | TIG-re vár | (buttons)`. Buttons: `Számla` (`data-inv`) if there are accepted rows, `TIG` (tmake) if there are waiting rows. Empty: `Üres.`
- `ar` tab: the original billing view's panels from the first `grid g2 margin-top:14px` onward.
- `in` tab (the L1900 override replaces the inbound panel):
  - Text: `Szabály: gépre vonatkozó költség gépazonosító nélkül nem adható fel a könyvelésbe. Az AI kiolvassa a számlát és javasolja a gépet vagy munkalapot; ember fogadja el. Emellett 3-utas egyeztetés: rendelés – QR-bevételezés – számla.`
  - Columns `Szállító · számla | Tétel | Nettó | Rendelés / bevételezés | AI: költséghely | Gép / költséghely | Könyvelés`.
  - The cost-centre select (`data-xc="inm"`) offers `— válasszon —`, the non-fuvar machine ids, `KÚT` and `—`. The button `Elfogad` (inai) shows when the AI has a value and `b.mach` is not set.
  - Fixed aibox `Pénzügyi elemző`: `A Komatsu-számla rendelés és munkalap nélkül jött: a DOZ-01-hez javaslok utólagos munkalapot (hibajegy a gépkezelő appból), hogy a javítás költsége a gép Ft/üzemórájába kerüljön. A Sandvik-számla rendelés nélkül érkezett: fizetés zárolva, amíg az ütőléc-beszerzést jóvá nem hagyják.`
  - The L1573 version (no longer visible) had a `Jóváhagyás` (inok) button and a different Fuchs/Sandvik aibox. `X.inok` stays defined but has no visible trigger after the override.
- `set` tab:
  - `Bizonylattömbök (Billingo)`: Számla `MP-2026-####`, Szállítólevél `MP-SZL-2026-####`, Előleg / díjbekérő `MP-E-2026-####`.
  - `Számlázási szabályok` list:
    - `Eseti vevő: számla a TIG elfogadásakor, megrendelésenként`
    - `Keretszerződéses vevő (V-Híd): havi gyűjtőszámla a havi TIG-ből`
    - `Magánszemély, új ügyfél: díjbekérő vagy előlegszámla, kiszállítás a befizetés után`
    - `Auto-kiállítás bruttó <mft(policy.autoInvoiceMaxGross)> alatt, felette jóváhagyás`
    - `Fizetés-párosítás naponta (Billingo + bankkivonat)`
    - `NAV Online Számla: a Billingo küldi, a státuszt visszaolvassuk`

### Bérszámfejtés (`payroll`)

- Head subtitle: `Bérelőkészítés a rendszerben lévő adatokból: jelenlét, menetidő (tachográf/iTrack), átvétellel vagy TIG-gel igazolt fordulók, munkalapok, műszaknapló, szabadság. A hivatalos számfejtés és a 08-as bevallás a bérszámfejtő programban marad (export).`
- Right control: select `Időszak` (`payper`) with `2026. szeptember (lezárt, importált adatok)` and `2026. október 1–3. (élő, a rendszer fuvaraiból)`.
- okt only: the aibox `Élő időszak` with the text `A sofőrök jelenléte, menetideje, éjszakai órái és igazolt fordulói közvetlenül a lezárt és elfogadott fuvarokból számolódnak (rakodás, út, lerakás + napi 1 óra előkészítés). Ha a Sofőr appban átvételt rögzít vagy TIG-et fogad el, a teljesítménybér itt azonnal nő. A szombati munka túlórának számít (rendes munkaidő: 2 nap × 8 óra).`
- Flow chips `Előkészítve→AI-ellenőrzés kész→Jóváhagyva→Exportálva` and the next-step button.
- KPIs: `Bruttó bér`, `Nettó kifizetés`, `Munkáltatói költség` (sub-label `szocho 13%`) and `Ellenőrzési tétel` (warn if above 0).
- `Sofőrök` table: `Név | Jelenlét | Menetidő | Igazolt forduló (ok/all) | Túlóra | Bruttó | Nettó`. Rows are `paysel`, and the selected row has the `selrow` class.
- `Egyéb dolgozók`: `Név | Munkakör | Jelenlét | Pótlék-óra (shiftH||night) | Bruttó | Nettó`.
- `Bérjegyzék-előnézet`: lines with `forrás: <src>`, then `Bruttó`, `SZJA 15%`, `TB-járulék 18,5%`, `Nettó (kedvezmények előtt)` and `Munkáltatói szocho 13%`.
  - okt drivers also get a live table `Nap | Fuvar | Idő | Vez. | Igazolás`, where Igazolás is `átvétel aláírva`, `TIG elfogadva`, `igazolásra vár` or `tervezett`.
  - Drivers get the note `Fordulók: <trips> teljesített, ebből <ok> átvétellel/TIG-gel igazolt. Várakozás a lerakókon: <wait> h (munkaidő, a vevőnek állásidőként továbbszámlázva).`
- `AI-ellenőrzés`: the checks list. Empty: `Nincs eltérés.`
- `Paraméterek`:
  - Number inputs (step 0.5, shown in %): `SZJA (%)`, `TB-járulék (%)`, `Szocho (%)`, `Túlórapótlék (%)`, `Éjszakai pótlék (%)` and `Műszakpótlék (%)`.
  - `Garantált bérminimum (Ft)` and `Eco-prémium ≥85 pont (Ft)`.
  - Note: `A családi és egyéb kedvezményeket, a levonásokat és a 08-as bevallást a bérszámfejtő program kezeli. A kulcsokat évente ellenőrizni kell.`
- `Folyamat`: step lines. When the status is `Exportálva`: a `<pre>` with the first 6 CSV lines followed by `…`.

### QR raktár (`qr`)

- Head subtitle: `Minden cikk, raktárhely, gép, tehergépkocsi, projekt, egység és munkalap QR-azonosítót kap. Bevételezés, kiadás, áthelyezés és leltár szkenneléssel; kiadás csak céllal együtt rögzíthető, így a költség mindig a megfelelő helyre kerül.`
- Tabs (`qsub`): `Szkennelés` | `Címkék` | `QR-napló` | `Projektek, egységek`.
- `scan` tab:
  - Mode buttons (`qmode`): `Bevételezés`, `Kiadás`, `Áthelyezés` and `Leltár`. The active one is `pri`.
  - Scanbox: msg; `form#qrform` with input `#qr-in` (placeholder `Kézi vagy vonalkódolvasós bevitel, pl. MP-CIKK-S3`, autocomplete off) and the button `Beolvas`.
  - File label `Fotó a QR-kódról` (`#qr-photo`, camera) with the text `A telefon kamerájával lefotózott címkét a rendszer dekódolja; ipari olvasó billentyűzetként ír a mezőbe.`
  - State table:
    - `Cikk`: name, code, `készlet <qty> <unit> · hely <loc>`, or `—`.
    - `Rendelés` (receive only): name or `— (opcionális)`.
    - `Cél` (issue only): `<kind>: <name>` or `— kötelező`.
    - `Raktárhely` (all modes except issue).
    - `Mennyiség` (all modes except move): `#qr-qty`, number, step 0.1.
  - Buttons `<mode label> rögzítése` (qcommit) and `Újrakezdés` (qreset).
  - Right panel `Gyors szkennelés (demó)`, text `Kattintás = a címke beolvasása.` Chip groups (`qscan` with `data-c`): `Cikkek`, `Célok` (`<kind>: <name>`) and `Raktárhelyek és rendelések`.
- `labels` tab: four groups, `Cikkek`, `Raktárhelyek`, `Gépek, tehergépkocsik, projektek, egységek, munkalapok` and `Nyitott beszerzési rendelések`.
  - Each label shows the QR image (or a `QR` placeholder), the code and the name. Clicking a label calls qscan. Empty: `Nincs.`
  - Footer: `Címkenyomtatás élesben ipari címkenyomtatóval (pl. Zebra, ZPL), időjárásálló címkével; a gépeken és teherautókon a vezetőfülkében.`
- `log` tab: `Idő | Művelet | Cikk (+code) | Menny. | Hova / mit (+tcode) | Érték | Költséghely`. Empty: `Még nincs QR-mozgás.`
- `proj` tab: `Projektek` and `Egységek` with the summed projCost per ref.
  - Note: `A gépre és tehergépkocsira kiadott tétel a gépköltségbe, onnan a termék önköltségébe kerül; a projekt- és egységköltség külön riportban.`

### Üzemi raktár (`store`), wrapped 3 times

- L1721: after `<h2>Kiadás gépre</h2>` it inserts `Napi munkában a <a data-go="qr">QR raktár</a> szkenneléses kiadását használják; ez a kézi tartalék.`
- L1912:
  - Inserts the header `<th>Kompatibilis gépek</th>` before `Egységár`. The body regex replace returns the match unchanged, so no body cell is added.
  - Appends the `Kút — RFID-tankolások` panel: text `gép RFID-címke → liter → gépköltség`, `form#rfidform` with select `#rf-m` (non-fuvar machine ids and the first 6 trucks), input `#rf-l` (default 237) and the button `Tankolás (szimuláció)`.
  - Table `Idő | RFID | Gép | Liter | Költség`. Empty: `Még nincs.`
  - Panel `Üzemanyagkártya-import (teherautók)` with the button `Heti kártyaexport betöltése` (cardimp) and the text `A kártyakibocsátó exportja (rendszám, kút, liter, összeg) automatikusan a jármű költségére kerül, és összevetődik az iTrack által detektált tankolással.`
  - Import alerts `<truck> · <where> · <l> l · <cost> — iTrack egyezik` or `— iTrack <it> l, eltérés <l-it> l`. Empty: `Még nincs import.`
- L1918: appends `· <span title="Kompatibilis gépek">compat list</span>` to each part's supplier line `<sup> · <lead> nap`.

### Fuvarok és EKÁER (`transport`), injected box

- Placed before the first `<div class="grid`.
- Panel title `EKÁER-bejelentések jóváhagyásra (<n>)`. Buttons `Mind kijelöl` (eksel) and `Kijelöltek beküldése a NAV-nak` (eksend; disabled if n is 0).
- Text: `Az EKÁER-ügyintéző ügynök előkészítette és ellenőrizte a bejelentéseket; a beküldés az EKÁER-admin döntése (a brief 17. pontja szerint).`
- Table `☐ | Fuvar | Nap | Vevő · termék | t | Rendszám | Érték | Indoklás (last reason)`. The checkbox class is `.ekchk`. Empty: `Nincs beküldésre váró bejelentés.`

### Gépkezelő app (`operapp`)

- Head subtitle: `Műszak végén a gépkezelő a telefonján 30–60 másodperc alatt zárja a műszakot: gép QR-kódja, óraállás, állásidő és oka, hiba fotóval. Ahol szalagmérleg, kanálmérleg vagy telematika van, az adat magától érkezik, a kezelő csak jóváhagyja.`
- Right control: select `Kezelő` (`opa-op`), listing employees whose role matches `/Rakodógép|Dózer/`.
- Phone card `Műszakzárás` with the date. `form#opaform` contains:
  - Select `Gép (QR-kód vagy választás)` (`#opa-m`, non-fuvar machines).
  - Info line `Adatforrás: <src> · előző óraállás: <h0> · szervizig <next> üzemóra`.
  - `Óraállás most` (`#opa-h`, step 0.1, default `h0+9.4`) and `Állásidő (óra)` (`#opa-idle`, default 0.6).
  - Select `Állás oka` (IDLE list).
  - Production machines (OSZT-01, TOR-01):
    - If `m.src==='szalagmérleg'`: the aibox `Szalagmérleg (automatikus)` with `0/4: 420 t · 4/11: 180 t · 11/22: 260 t · 22/63: 510 t — a kezelő csak jóváhagyja`.
    - Otherwise the input `Feladott anyag (t, kanálmérleg)` (`#opa-feed`, default 1520).
  - Checkbox `Hiba volt a műszakban` (`#opa-fault`).
  - Input `Hiba leírása` (placeholder `pl. hidraulika szivárog a bal emelőhengernél`).
  - File label `Fotó a hibáról` (`#opa-photo`, camera).
  - Submit `Műszak lezárása`.
- `Ma rögzítve`: lines `<id> · <operator> · <run> h üzem, <idle> h állás[ · hiba: <fault>]`.

### Szerelő app (`mechapp`)

- Head subtitle: `Minden javításból digitális munkalap. A szerelő a telefonján indítja és zárja, hozzáadja a társait, QR-kóddal veszi ki az alkatrészt: a raktárból le, a munkalapra és a gép költségére rá.`
- Right control: select `Szerelő` (`mch-me`), listing role `Szerelő`.
- `Nyitott munkalapok (<n>)`: alerts (mchsel). The dot is bad for Hibajegy, ai for Folyamatban, otherwise warn. Empty: `Nincs nyitott munkalap.`
- Phone card:
  - `<id>` and pill, machine name, `<name>[ · forrás: <ref>]`, then `Kezdés: <HH:MM|—> · Szerelők: <names|—>`.
  - Buttons: `Munka indítása` (if not started) and `Csatlakozom` (if started and I am not in mech).
  - After start:
    - `Alkatrész kivétele`: select `#jm-part` (compatible parts first; incompatible ones get the suffix ` (nem kompatibilis!)`), qty `#jm-q` (step 0.5, default 1), button `Kivét (QR)`. A list of used parts follows.
    - `Elvégzett javítás` (`#jm-done`; default `tömítéscsere, nyomáspróba` for Hibajegy, otherwise `szerviz a gyártói előírás szerint`).
    - `Munkaóra összesen (ha eltér a mérttől)` (`#jm-h`, default `w.hours||3`).
    - File label `Fotó`. It has no handler or id, so it has no effect.
    - `Munkalap lezárása`.
- `Lezárt munkalapok`: `Munkalap | Gép | Munka | Szerelők | Óra | Alkatrész | Munkadíj`. Empty: `Még nincs.`

### Gépek (`machines`), appended panel

- `Digitális gépüzemnapló` with the button `Gépkezelő app` (`data-go="operapp"`).
- Text: `Adatforrás-sorrend: szalagmérleg / PLC → rakodó kanálmérlege → kezelői jelentés. Ahol automatikus adat van, a kezelő csak jóváhagy.`
- Columns `Napló | Nap | Gép | Kezelő | Forrás | Óraállás | Üzem | Állás | Ok | Termelés | Hiba`.
  - The source pill is ok for `/szalag|telem|PLC/`.
  - Termelés shows `<first word of product>: <t> t` joined with `·`, or `feladás <t> t`.
  - The Hiba column is in the bad colour.

### Mérleg (`scale`)

- Head subtitle: `Kamera → rendszám → jármű → mai elfogadott fuvar → mérlegelés → nettó tömeg → szállítólevél. A tonnát senki nem gépeli be; ember csak eltérésnél (ismeretlen rendszám, nincs fuvar, túltöltés, hiányzó EKÁER) nyúl hozzá.`
- KPIs: `Ma mérlegelve` (anpr done), `Átlagos várakozás a rakodásnál` (average loadWait, all entries), `Mai fuvar mérlegre vár` and `Kivétel ma` (anpr with exc).
- Panel `Hídmérleg — Polgárdi` with the button `Jármű érkezik (szimuláció)` (scarrive). Idle text: `Várakozás járműre. A kamera a kapunál olvassa a rendszámot.`
  - Own-vehicle card:
    - Table: `Felismert rendszám` (plate and conf % pill), `Jármű`, `Mai fuvar`, `Vevő · termék`, `Sofőr`, `EKÁER`.
    - KPI `Bruttó (mérleg)` with `tára <t> t (járműtörzs) · nettó <n> t · terv <p> t`.
    - `Várakozás a rakodásnál: <w> perc (kapu → mérleg)`.
    - Block alerts.
    - Buttons `Mérlegjegy → szállítólevél` (scok, disabled when there are blocks) and `Félreállít, következő` (scnext, only when there are blocks).
  - Waste card: `Felismert rendszám: <plate> → hulladék-beszállító: <partner>. Bruttó <g> t.` and the button `Hulladék-beszállítás rögzítése` (sctowaste).
  - Unknown card: alert `Ismeretlen rendszám: <plate> (<conf>% bizonyosság). Nincs a járműtörzsben és nincs mai fuvarja.`, input `#sc-plate` (placeholder `Rendszám javítása`), and the buttons `Javítás` (scfix) and `Elküld (nincs fuvarja)` (scnext).
- `Mai mérlegelések`: `Idő | Rendszám | Felismerés | Párosítás | Nettó | Várakozás | Eredmény`. Eredmény is an exc warn pill or `szállítólevél`. Empty: `Még nincs.`

### Hulladéklerakó (`waste`)

- Head subtitle: `Partner, rendszám, hulladékkód, mérlegelés, kísérő dokumentum, díj és számlázás egy helyen, közös mérleggel és ügyféltörzzsel.`
- Tabs (`wtab`): `Beszállítások` | `Új beszállítás` | `Partnerek és engedély` | `Havi nyilvántartás` | `Számlázás`.
- `list` tab: `Sorszám | Nap | Partner | Rendszám | Hulladékkód (+name) | Nettó | Kísérő dok. (+ · fotó) | Díj (fee+taxFee) | Állapot`. Állapot is `Számlázva` or `Kiállításra vár`. There is no empty-state row.
- `new` tab: text `A mérleg és a rendszámfelismerés tölti a partnert, a bruttót és a tárát; a kezelő a hulladékkódot és a kísérő dokumentumot rögzíti. A fogadási engedélyben nem szereplő kódot a rendszer nem engedi.` `form#wform` contains:
  - `Partner` (`#w-p`; default = the partner owning `pre.plate`, otherwise W1).
  - `Rendszám` (`#w-plate`; default `pre.plate` or the partner's first plate).
  - `Hulladékkód` (`#w-code`; options `<code> — <name>`, with ` (engedélyben nincs)` added when not permitted).
  - `Kísérő dokumentum száma` (`#w-doc`; default `SZJ-2026-<100+wlog.length>`).
  - `Bruttó (t, mérleg)` (`#w-g`; default `pre.gross||31.8`) and `Tára (t, járműtörzs)` (`#w-t`; default 14.2).
  - File label `Kísérő dokumentum fotója` (`#w-photo`, camera).
  - Submit `Rögzítés`.
- `part` tab:
  - `Partnerek`: `Partner | KÜJ / KTJ | Rendszámok | Szerződött kódok`, with the note `A partner a közös ügyféltörzsből jön (a V-Híd vevő és hulladék-beszállító is).`
  - `Fogadási engedély és díjak`: `Kód | Megnevezés | Díj (Ft/t) | Engedély`. The pill is `fogadható` or `nem fogadható`.
  - Number input `Lerakási járulék (Ft/t) — a jogszabály szerinti értéket a felmérésben kell rögzíteni` (`data-xc="wtax"`).
- `rep` tab: `Havi nyilvántartás — 2026. október` with the text `Hulladékkódonként átvett mennyiség; ebből készül a hatósági adatszolgáltatás (a pontos kötelezettséget a felmérésben jogilag tisztázni kell).`
  - Columns `Kód | Megnevezés | Átvett (t) | Beszállítás`. Button `Nyilvántartás letöltése (CSV)` (wcsv).
- `bill` tab: `Havi gyűjtőszámla partnerenként`: `Partner | Beszállítás | Tonna | Nettó díj | Számla (Billingo)` (winv). Empty: `Nincs számlázatlan beszállítás.`

### Fuvarszervezés (`dispatch`), tab `Napi tonnacél`

- In every other tab, the tab button `Napi tonnacél` (`data-x="dtab" data-k="cap"`) is appended after `Szabályok`.
- `cap` tab:
  - Panel `Mennyi autó kell?` with the text `„Holnap X tonna ide” → hány autó, hány forduló, melyik sofőr. A számítás a jármű-teherbírást, a cím korlátozásait, a ciklusidőt (rakodás + út + lerakás + vissza), a napi 9 órás vezetési időt és az aznap már kiosztott fuvarokat veszi figyelembe.`
  - Fields:
    - `Megrendelés (opcionális)` (`capo`; `— szabad számítás —` plus `<id> · <client>`).
    - `Nap` (date, `capd`).
    - `Céltonna (t)` (`capt`).
    - With an order: `Cím: <zip> <city> · <product>`. Without: `Irányítószám` (`capz`).
  - Panel `Eredmény`:
    - KPI `Autó` = rows, with `<n> jármű alkalmas a címre`.
    - KPI `Forduló` = Σ trips, with `<km> km, ciklus <cyc> h`.
    - Alert: `<tn(left)> nem fér bele a napba — két napra kell bontani, vagy alvállalkozót bevonni.` (bad), or `A céltonna egy nap alatt teljesíthető.` (ok).
    - Table `Jármű (type, cap) | Sofőr | Forduló | Tonna`.
    - With an order: the button `Fuvarjavaslatok létrehozása erre a napra` (capmake).

### Riportok, `Anyagmérleg` report

- `Napi anyagmérleg` with the date input `Nap` (`mbd`).
- Flow: `Kitermelés / feladás <feed>` → `Törés, osztályozás` → `Késztermék <out>` → `Veszteség, meddő <loss>`.
- Text: `ERP-készlet = tegnapi zárókészlet + mai termelés − mai értékesítés ± átszállítás és helyesbítés. A termelés forrása: …`. The source part is `műszaknapló (kanálmérleg)`, `+ szalagmérleg (OSZT-01)` or `nincs termelés ezen a napon`. It ends with `Fizikai ellenőrzés: havi drónos felmérés.`
- Columns `Frakció | Nyitó | + Termelés | − Értékesítés | ± Egyéb | Záró ERP-készlet`.

### Ma (mobil) (`today`)

- Head subtitle: `A tulajdonos egy képernyője telefonra: mi történt ma a bányában, a gépeken, az utakon és a pénzben. A brief 18. pontjának mutatói.`
- `.phone` (max-width 440px) with 10 tiles:
  - `Mai kitermelés (feladás)` (`műszaknapló + kanálmérleg`)
  - `Kiszállítva` (`<done>/<all> forduló`)
  - `Árbevétel ma` (`termék + fuvardíj`)
  - `Fedezet ma` (pct)
  - `Dolgozó autó` (`<working>/<trucks>`)
  - `Várakozás` (`<loadWait> perc`, or `—`, with `rakodás · lerakón <dropWait|—>`)
  - `Üzemanyag ma` (`RFID-tankolás`)
  - `Gépállás ma` (reasons; warn if above 2 h)
  - `Kintlévőség`
  - `Lejárt` (bad if above 0)
- Panels:
  - `Termelés gépenként ma`. Empty: `Ma még nincs termelés.`
  - `Szervizben, hibák`. Empty: `Nincs.`
  - `Készlet frakciónként`, with bars of width `max(2, t/max*100)%`.
  - `Vevők fedezete (hónap)`. The pill is bad below 15 %, warn below 25 %, otherwise ok.
  - `Gépek Ft/üzemóra`, with the footer `Ft/t: Riportok → Gépköltség`.
- AI box `Mészkő-Polgár AI`:
  - If `SAMPLE` exists: the buttons `Mi történt ma?` and `Miért termeltünk ma kevesebbet?` (`data-x="askq" data-q`), and the answer area showing `Gondolkodik…` while busy.
  - Otherwise: `A claude.ai-ban megnyitva a tulajdonos itt kérdezhet: „Mi történt ma?”`

### Terv (`plan`), appended panel

`Bevezetés a brief négy üteme szerint`:

- `Felmérés · 1–2. hó`: `folyamatok, adatok, hozzáférések, platformdöntés`
- `1. ütem: ERP-alap · 3–4. hó`: `ügyfél, beszállító, rendelés, számlázás (Billingo, NAV), mérleg, könyvelési feladás, hulladéklerakó`
- `2. ütem: Operáció · 5–7. hó`: `fuvarszervezés, GPS, gépüzemnapló, szerviz, QR-raktár, üzemanyag, bányatermelés`
- `3. ütem: Automatizáció · 8–9. hó`: `EKÁER, bank, dokumentum-AI, rendszámfelismerés, mobilfelületek`
- `4. ütem: AI + controlling · 10–12. hó`: `„Ma” nézet, fedezetszámítás, anomáliafigyelés, vezetői AI-asszisztens`

---

## Device & library usage

- **Canvas signature pad** (sigPad/bindSig at L1384–1391, bound in range by the `bindForms` wrapper at L1693):
  - `<canvas class="sig" width=520 height=150>` with a `Törlés` button (`sigclear`, which clears the canvas and the dirty flag).
  - Pointer events with pointer capture. Coordinates are scaled to canvas pixels. Line width 2.2, round caps, stroke colour = the computed body text colour.
  - `sigData(id)` returns a PNG data URL only if the pad was drawn on (`dataset.dirty`), otherwise null.
  - Pads in range: `ps-<fid>`, `pt-<fid>`, `ts-sig` and `cs-s-<contractId>`.
- **Photo capture/upload**: `<input type=file accept="image/*" capture="environment">`. `readPhoto` downscales to a max of 900 px and returns a JPEG data URL (quality 0.75); if the image fails to decode it returns the original data URL.
  - Targets: data-photo `pod`, `tig`, `contract` (also accepts `.pdf`, but readPhoto falls back to the raw data URL), `extdn`; plus `#opa-photo` (→ OPAPHOTO, toast `Fotó csatolva.`) and `#w-photo` (→ WPHOTO, toast `Dokumentum-fotó csatolva.`).
  - The `Fotó` input in the mechanic app has no handler.
- **QR generation** (qrious): `qrImg` with size 180, ECC level M, white background, black foreground, PNG data URL, cached per code. Used only in the `Címkék` tab.
- **QR decode** (jsQR): `decodeQR` reads the photo from `#qr-photo` through FileReader, downscales to a max of 1000 px on a canvas, and calls `jsQR(imageData.data, w, h)`. `res.data` is the code. There is no live camera stream: the camera is used only through `capture="environment"` file input. A keyboard-wedge scanner can type into `#qr-in`; on submit the input is refocused.
- **PDF parse** (pdf.js 2.16.105):
  - Applies to `#em-file` with a `.pdf` extension. A capture-phase document change listener calls `stopImmediatePropagation` so the earlier text-file handler does not run.
  - `workerSrc = https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`. It reads up to 5 pages; text items are joined with `\n` when `hasEOL`, otherwise with a space.
- **XLSX parse** (SheetJS):
  - Applies to `.xlsx` and `.xls`. `XLSX.read(Uint8Array, {type:'array'})`, first 2 sheets, `sheet_to_csv` with `FS:' '`.
  - For each line, `(\d)\s+(t|m3)\b` is normalized to `$1 $2`.
  - If the library is missing or throws: toast `A fájlt nem sikerült beolvasni ebben a nézetben.`
- **CSV exports**. Both use the `window.claude?.use?.('downloads')` → `dl.save({filename, data})` runtime API and prefix the data with a UTF-8 BOM (U+FEFF).
  - Payroll `berfeladas_2026_09.csv`, with the same filename for both periods.
    - Header `torzsszam;nev;munkakor;alapber;tulora;potlek;teljesitmenyber;premium;brutto`.
    - One row per employee from `empsFor()`: `[<id>]`, name, role.
    - `alapber` = Σ lines matching `/Alapbér|Havi alapbér|Távolléti/`, case-sensitive. The okt `Időarányos alapbér` line therefore does not match and gives 0.
    - `tulora` = `/Túlóra/`, `potlek` = `/pótlék/`, `teljesitmenyber` = `/Teljesítmény/`, `premium` = `/prémium/i`, `brutto` = gross.
    - Separator `;`, newline `\n`, integer values. If the download API is missing, nothing happens and no toast is shown.
  - Waste `hulladek_nyilvantartas_2026_10.csv`.
    - Header `sorszam;datum;partner;rendszam;hulladekkod;netto_t;kisero_dok`.
    - Rows: id, ISO date, partner name, plate, code, net with a decimal comma, doc number.
    - If the download API is missing: toast `A letöltés ebben a nézetben nem érhető el.`
- **Weighbridge camera/ANPR**: fully simulated by `X.scarrive`. There is no media API.
- **AI**: the global `SAMPLE(prompt, {tools, onText})` (claude.ai runtime), used by the today view.
- **Storage**: `localStorage['mperp-route']`, read at bootstrap (try/catch).

---

## Global event delegation & bootstrap

The delegation itself is defined at L739 (change) and L750 (click), outside the range. Everything in range plugs in through `X`, `XC`, `data-photo`, form ids and the `bindForms` chain.

- **Click** (`closest(...)` over `data-go, data-cancel, data-storno, data-x, data-job, data-retry, data-sync, data-retryall, data-act, data-inq, data-qopen, data-qapprove, data-qreprice, data-qorder, data-plan, data-inv, data-f, data-ekaer, data-close, data-doc, data-issue, data-po, data-recv, data-ok, data-no, data-rep, data-setprice`). Keys used in range:
  - `data-go`: navigation (`qr` link in the store, `operapp` in machines).
  - `data-x`, defined in range:
    - `pod`, `sigclear` (defined just before the range), `csub`, `copen`, `csend`, `cremind`, `cportal`, `tplsave`
    - `topen`, `tmake`, `tsign`, `tobj`, `pcsign`, `topen2`
    - `tsel`, `itsync` (no handler defined in range)
    - `dnopen`, `dnresend`, `dncorr`, `dnstorno`
    - `invtab`, `markpaid`, `corrinv`, `newadv`, `inok`
    - `paysel`, `payai`, `payok`, `payexp`
    - `qsub`, `qmode`, `qscan`, `qreset`, `qcommit`
    - `eksel`, `eksend`
    - `mchsel`, `jmstart`, `jmjoin`, `jmpart`, `jmclose`
    - `scarrive`, `scnext`, `scfix`, `scok`, `sctowaste`
    - `wtab`, `wcsv`, `winv`, `inai`, `cardimp`, `direct`, `capmake`
    - `ask` (wrapped), `askq` (wrapped), `ask5` (called directly)
    - `dtab` with `k="cap"` uses the existing dtab handler.
  - `data-doc` (invoice row → `sel.doc`), `data-issue` (approve the pending approval or call `issueInvoice`), `data-storno` (Billingo cancel job), `data-inv` (`invoiceOrder` then `go('billing')`), `data-close` (driver app: reads `#w-<id>` and `#wt-<id>`, then `closeTransport`), `data-rep` (`sub.reports = key; go('reports')`, used for `mb`).
- **Change**:
  - `data-xc`, defined in range: `drv`, `tsel`, `dnq`, `dnst`, `dncl`, `invq`, `invt`, `payper`, `paycfg`, `paycfg2`, `opa-op`, `mch-me`, `inm`, `wtax`, `capo`, `capd`, `capt`, `capz`, `mbd`.
  - Separate document change listeners: `[data-photo]` (L1409) and `#em-file` PDF/XLSX in the capture phase (L1934).
- **bindForms chain**, run after every render, in this order:
  - `_bind4`: `bindSig()`, the `#qrform` submit, and the `#qr-photo` change → `decodeQR`.
  - `_bind5`: `bindTimeline()`.
  - `_bind6`:
    - `#opaform` submit → `closeShift5`
    - `#opa-photo` change → OPAPHOTO
    - `#opa-m` change → `OPA.machine`, render
    - `#wform` submit → waste validation and record
    - `#w-photo` change → WPHOTO
    - `#rfidform` submit → `rfidFill`
    - All submit handlers call `preventDefault`. `_bind6`'s `on` helper does not render by itself; each handler renders.
- **Function overrides installed in range**: `counts` (twice), `decide`, `seed` (twice), `ekaerSubmit`, `parseInquiry`, `inqDetail`, `erpTools`, `bindForms` (three times), `X.ask` and `X.askq`.
  - View wrappers: `V.portal`, `V.billing` (twice), `V.transport`, `V.store` (three times), `V.machines`, `V.inbox`, `V.dispatch`, `V.reports`, `V.plan`.
  - New views: `V.contracts`, `V.tig`, `V.telem`, `V.dn`, `V.payroll`, `V.qr`, `V.operapp`, `V.mechapp`, `V.scale`, `V.waste`, `V.today`.
  - New report: `R.mb`.
- **Startup sequence** (L2040–2041), run after all the definitions above:
  1. `SEEDING = true`, which suppresses toasts.
  2. `seed()`: the original seed, then wrapper #4 (contracts, PODs, auto-assign and accept, first closing, TIG, extra orders, qrlog, itrackSync, buildTelemStats), then wrapper #5 (mlog, JM, RFID, loadWait/anpr, waste, EKÁER prepare).
  3. `SEEDING = false`.
  4. `route` is restored from `localStorage['mperp-route']` if `V[route]` exists (try/catch).
  5. `render()`.
- The script closes at L2042 (`</script>`).
