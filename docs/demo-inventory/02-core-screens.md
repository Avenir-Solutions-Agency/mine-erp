# Functional inventory — part 2 (source lines 470–900)

Global context used in this range (defined elsewhere, only referenced): `route` (initial `'dash'`), `sub={reports:'pnl'}`, `sel={}` (selection ids: `sel.inq`, `sel.q`, `sel.f`, `sel.doc`, `sel.job`), `SEQ` counters, `TODAY` (demo date), helpers `log(actor,what,ref)` (unshifts into `S.audit`), `approval(kind,refId,title,reason,ai)` (creates `{id:'J-'+SEQ.AP++, status:'Vár'}` in `S.approvals`), `job(system,op,ref,payload,fn,onFail)` (outbox job with idempotency key; dedups on an existing successful job with the same key), `runJob`, `retryJob`, `mode(agentId)`, formatters `fmt/ft/mft/tn/pct/ds/iso/esc`, lookups `P(pid)`, `C(clientId)`, `D(depotId)`.

## Core UI helpers (lines 470–493)

- `go(r)`: sets `route=r`, stores it in `localStorage['mperp-route']` (try/catch), calls `render()`, scrolls to top.
- `toast(m)`: no-op while `SEEDING===true`; otherwise writes `m` into `#toast`, unhides it, auto-hides after 3400 ms (previous timer cleared).
- `stPill(s)`: status string → `<span class="pill {class}">`. Mapping:
  - `ok`: "Kiküldve", "Ajánlat kiküldve", "Lezárva", "Billingóban kiállítva", "Bejelentve", "Teljesítve", "Jóváhagyva", "Beérkezett", "Iktatva", "Elfogadva (e-aláírás)", "Elfogadva (aláírt fotó)", "Átvéve", "Átvéve (aláírva)", "Aláírva (elektronikusan)", "Aláírt példány feltöltve", "Exportálva", "Kiegyenlítve"
  - `acc`: "Megrendelve", "Új", "Úton", "Ütemezve", "Visszaigazolva", "Megrendelve (PO)", "Számlázva"
  - `ai`: "Jóváhagyásra vár", "Vár", "Javasolt", "Aláírásra vár"
  - `warn`: "Hiányos — visszakérdezés", "Bejelentendő", "Kézi feldolgozásra vár", "Úton / átvételre vár", "Kiállításra vár", "Sorban (Billingo)", "Újrapróbálás", "Késik"
  - `bad`: "Elutasítva", "Kifogásolva", "Hiba", "Lejárt", "Sztornó"
  - none: "Piszkozat", "Tervezett", "Nem szükséges", "Felülírva", "Törölve", and any unknown status.
- `flagHtml(f)`: `<div class="alert"><span class="dot {f.lvl}"></span><div>{f.t}</div></div>`.
- `head(t,s,right='')`: page header: `<h1>` title, optional `<p class="sub">` subtitle, right slot + fixed badge "Példaadatok · 2026. 10. 03.".

## Charts (lines 477–493), inline SVG, viewBox width 640

- `barChart(labels, series[{n,c,v[]}], {h=200, colors, fmtY=fmt, stack=false})`: grouped (or stacked if `stack`) vertical bars. Y max = max value (or stack sum) × 1.1 (fallback 1), rounded up to a "nice" step (`nice()`: range/4 rounded to 1/2/5/10 × power of 10). Horizontal grid lines with Y labels via `fmtY`; X labels centered under each group. Each rect has `<title>` "{label} · {series name}: {value}". Bar width: grouped 75% of slot ÷ series count; stacked 55% of slot. Corner radius 2. (`colors` option unused.)
- `lineChart(labels, series[{n,c,v[],area}], {h=200, fmtY, zero=true, mark})`: polyline per series, stroke width 2, dot (r 3.5) on last point; optional filled area (opacity .12) when `area`. Y range from min (includes 0 if `zero`) to max, snapped to nice step. X labels shown every ceil(n/8)-th point plus last. `mark={v,l}`: dashed horizontal red (`--bad`) reference line with right-aligned label.

## cashflow() (lines 495–515): 13-week forecast

- Start balance 62 000 000 Ft; weeks start Monday 2026-10-05, 13 weeks of 7 days (`a` … `b=a+6`).
- `monthlyRev = costModel().revenue`; `wage = Σ S.staff.gross`.
- Receivables: every `S.docs` with `type==='Számla'`, `!paid`, `due` set. Expected date = `due` if not late; if late (`due<TODAY`): TODAY+12 days if more than 7 days overdue, else TODAY+5. Item label "Lejárt, behajtás alatt: {number}" (late) or "Esedékes: {number}", amount = gross.
- Inflow from week index 3 on: `monthlyRev×1.27/4.33×0.92`, item "Várható befolyás (nyitott rendelések + trend)".
- Day-of-month outflows (each day inside the week): 10th "Nettó bérek" = wage×0.665; 12th "Bérjárulékok, SZJA, szocho" = wage×(0.335+S.szocho); 20th "ÁFA-befizetés (becslés)" = monthlyRev×0.27×0.55; 15th "Lízing (tehergépkocsik)" 3 400 000; 25th "Robbantás alvállalkozó" 4 200 000; 10th "Bérelt gépek" 8 600 000×1.27; 20th "TAO- és HIPA-előleg, bányajáradék" 4 500 000.
- Every even week: "Gázolaj-töltés" = 28 000×S.diesel×1.27.
- Every week: overhead rows with category `'rezsi'` summed /4.33×1.27 (no item line); "Alkatrész, kenőanyag beszerzés" 2 600 000.
- Week index 4: "Törőpofa (jóváhagyott PO)" 2 850 000×1.27.
- Returns `[{a,b,inn,out,bal,items:[[label,amount]]}]`, `bal` cumulative.

---

### dash — "Tulajdonosi irányítópult"

Subtitle: "Szeptember zárt hónap, október élő adatok. Minden szám a készletnaplóból, a gép-, bér- és rezsitörzsből számolódik."

- Layout:
  - KPI row (4 cards, `grid g4`):
    1. "Árbevétel · szept." = `mft(cm.revenue)`; sub "ebből fuvardíj {mft(cm.freightRev)}".
    2. "Üzemi eredmény · szept." = `mft(cm.revenue − cm.totalCost)`; sub "árrés {pct(ebit/revenue)} · amortizációval".
    3. "Legalacsonyabb pénzállás · 13 hét" = min `bal` across `cashflow()` weeks; value colored `--warn` if < 15 000 000; sub "{ds(week.a)} hete".
    4. "Döntésre vár" = count of approvals with status "Vár" (`counts().ap`), colored `--ai`; contains button "Jóváhagyások megnyitása".
  - Row 2 (`grid g2`):
    - Panel "Árbevétel és költség", legend "Árbevétel" (accent) / "Költség" (muted). Grouped bar chart: labels `S.pnl.months` + "szept."; series Árbevétel = `S.pnl.rev` + revenue/1e6, Költség = `S.pnl.cost` + totalCost/1e6; Y format "{n} M".
    - Panel "Pénzállás, 13 hetes előrejelzés" with button "Részletek". Line chart: labels = `ds(week.a).slice(6,13)`; series "Záró" = bal/1e6 with area; mark at 15 labelled "15 M Ft biztonsági szint"; Y "{n} M".
  - Row 3 (`grid g2`):
    - Panel "Figyelmeztetések": list of alerts (flagHtml). Sources, in order:
      - each product with free stock (`stockOf − reservedOf`) < `p.min`: level `bad` if negative else `warn`; text "{name}: szabad készlet {tn(s)} (minimum {tn(min)})".
      - each `reorderSuggestions()` with `need`: `warn`, "Üzemi raktár: {name} — {fmt(cover)} napra elég, szállítási idő {lead} nap".
      - each machine with stage ≠ 'fuvar' and `next<50`: `bad`, "{name}: szerviz {next} üzemóra múlva esedékes".
      - each client with limit and used/limit > 0.85: `warn`, "{name}: hitelkeret {pct} kihasználva".
      - Empty state: "Nincs nyitott figyelmeztetés."
    - Panel "Termékek fedezete" with button "Önköltség-számítás". Table columns: Termék | Önköltség | Listaár | Fedezet. Rows sorted by margin ascending; margin = (price − cm.unit[id]) / price; pill `bad` if < policy.minMargin, `warn` if < policy.targetMargin, else `ok`.
  - AI box "Pénzügyi elemző · heti összefoglaló": paragraph = `insights(cm,cf)` sentences joined by space.
- Controls:
  - "Jóváhagyások megnyitása" (button, `data-go="ai"`): always visible; navigates to `ai`.
  - "Részletek" (button, `data-rep="cash"`): sets `sub.reports='cash'`, navigates to `reports`.
  - "Önköltség-számítás" (button, `data-rep="cost"`): sets `sub.reports='cost'`, navigates to `reports`.
- `insights(cm,cf)` produces 4 sentences:
  1. "A legkisebb fedezetű termék a {name} ({pct}); célárrés mellett {ft(ceil(unit/(1−targetMargin)/10)×10)}/t lenne az ár."
  2. "A legdrágább gép a {name}: {mft(total)} a hónapban, {ft(perH)}/üzemóra." (max `cm.mach.total`)
  3. "Fuvarköltség {ft(cm.ftPerKm)}/km a saját flottán — az ajánlatok ezzel számolnak."
  4. If min balance < 15 M: "Figyelem: {ds(week)} hetében a pénzállás {mft}-ra csökken; javasolt a lejárt vevőszámlák behajtása vagy egy nagy beszerzés halasztása." else "A pénzállás 13 héten át a biztonsági szint felett marad."

### inbox — "Ajánlatkérések"

Subtitle: "Web és e-mail egy helyen. Az AI kinyeri a tételeket, árat számol, és a házirend alapján kiküldi vagy jóváhagyásra teszi."

- Selection: current = `S.inquiries` item with id `sel.inq`, else first inquiry.
- Layout: two columns (`grid g2`). Left stack:
  1. Panel "Beérkezett": table columns Csatorna | Feladó (name or from, with from as small line) | Tárgy | Állapot (stPill) | Bizonyosság (`pct(conf)` or "—"). Each row clickable (`data-inq`), cursor pointer.
  2. Panel "Új e-mail szimulálása": help text "Illesszen be egy tetszőleges ajánlatkérő levelet. Élesben ez a vevo@ postafiókra érkező levél (Microsoft 365 / Gmail webhook)."
     - Field "Feladó e-mail": text input `#em-from`, default "beszerzes@vhid.hu", no validation.
     - Field "Tárgy": text input `#em-subj`, default "Árajánlat kérés — M0 lehajtó".
     - Field "Levél szövege": textarea `#em-body`, 6 rows, default:
       "Jó napot!\n1134 Budapest, Váci út 45. címre kérnénk:\n450 t Z 0/63\n80 t terméskő 63/180\n2026.10.15-ig. Köszönöm, V-Híd Építő Zrt."
     - Button "Beérkeztetés és AI feldolgozás" (`data-act="email"`).
  3. Panel "Webes ajánlatkérő (a mpkft.hu űrlapja)": `<form id="webform">`:
     - "Név / cégnév": text `#wf-name`, required, default "Pintér Építő Bt."
     - "E-mail": email `#wf-mail`, required, default "iroda@pinterepito.hu"
     - "Termék": select `#wf-prod`, options = all `S.products` (value id, label name), default first.
     - "Mennyiség (t)": number `#wf-qty`, min 1, default 60.
     - "Irányítószám": text `#wf-zip`, default "8200", pattern 4 digits.
     - "Település": text `#wf-city`, default "Veszprém".
     - "Kért nap": date `#wf-date`, default 2026-10-09.
     - Submit button "Ajánlatot kérek".
     - Note: "Az ügyfél 1–2 percen belül megkapja az árat, ha a házirend engedi az automatikus küldést."
  - Right column: `inqDetail(cur)` if there is a current inquiry, else empty.
- Controls:
  - Inquiry row click (`data-inq`): `sel.inq = id`; `render()`.
  - "Beérkeztetés és AI feldolgozás": builds inquiry `{id:'INQ-'+(++SEQ.INQ), channel:'E-mail', from:#em-from, name:'', subject:#em-subj, received:now, status:'Új', raw:#em-body}`; `S.inquiries.unshift`; `processInquiry(r)`; `sel.inq=r.id`; `render()`; toast "Feldolgozva: {r.status}". No input validation.
  - Web form submit (HTML required/pattern/min validation applies first): `preventDefault`; builds `{id:'INQ-…', channel:'Web', from:wf-mail, name:wf-name, subject:'Webes ajánlatkérő', received:now, status:'Új', raw:"Termék: {product name} — {qty} t\nCím: {zip} {city}\nKért időpont: {date with '-'→'.'}.\n{name}"}`; unshift; `processInquiry(r)`; `sel.inq=r.id`; `render()`; toast "Feldolgozva: {r.status}".
- Empty state: if no inquiries, table empty and detail column empty (no message).

#### inqDetail(i)

- Panel: h2 = subject, status pill; meta line "{channel} · {from} · {ds(received)}"; raw message in `<pre class="json">` (pre-wrap).
- AI box "Ajánlatkérés-feldolgozó · kinyert adatok", key/value table from `i.ex` (default `{lines:[]}`):
  - "Ügyfél": if `ex.clientId` → client name + pill ok "törzsben"; else `ex.company` or `i.name` + pill warn "új ügyfél".
  - "Tételek": each line "{product name} — **{tn(qty)}**" plus small "({note})" if note; joined by line breaks; empty → pill warn "nem található".
  - "Szállítási cím": "{zip} {city} {addr} · {distKm(zip)} km" or pill warn "hiányzik".
  - "Határidő": `ds(date)` or pill warn "hiányzik".
  - "Bizonyosság": `pct(conf||0)` + " · hiányzik: {missing joined ', '}" when missing non-empty.
  - If `i.reply`: h3 "Visszakérdező válasz-piszkozat" + reply text.
  - If linked quote (`S.quotes` with id `i.quoteId`): button "Ajánlat {q.id} megnyitása" (`data-qopen`) → `sel.q=id`; `go('quotes')`.

### quotes — "Árajánlatok"

Subtitle: "Az ár önköltségből, fuvartávolságból, kedvezményszintből és célárrésből áll össze. Ami a házirend alatt marad, ember hagyja jóvá."

- Selection: `S.quotes` item with id `sel.q`, else first.
- Left panel table: Sorszám (mono id) | Ügyfél (clientName + small "{zip} {city}") | Nettó (`ft(pr.net)`) | Árrés (pill: bad < minMargin, warn < targetMargin, ok) | Állapot. Row click `data-qopen` → `sel.q=id`; `go('quotes')`.
- Right: `quoteDetail(cur)`.
- Empty: no quotes → empty table, no detail.

#### quoteDetail(q)

- h2 "{id} · {clientName}", status pill.
- Flow breadcrumb: "Ajánlatkérés" (highlighted if `q.inq`) → "Ajánlat" (always on) → "Megrendelés" (on if `q.orderId`) → "Fuvar" → "Számla".
- Small line: "Szállítás: {zip} {city} {addr} · {km} km · {trips} forduló · érvényes: {ds(valid)}".
- Table columns: Tétel | Menny. | Önköltség/t | Egységár/t | Nettó | Árrés; one row per `pr.lines`. Extra freight row: "Fuvardíj" + small "({trips} × {km×2} km × {ft(costModel().ftPerKm)} + útdíj, +{pct(freightMarkup)})", qty = `tn(totalT)`, cost/t = freightCost/totalT, unit = freightPerT, net = freightNet. Footer: "Nettó összesen · bruttó {ft(gross)}" | net | margin.
- h3 "Ellenőrzések": `pr.flags` as alerts; empty → ok alert "Árrés, készlet és hitelkeret rendben."
- Buttons:
  - "Jóváhagyom és kiküldöm" (`data-qapprove`, primary), visible when status "Jóváhagyásra vár": finds approval with `refId===q.id` and status "Vár"; if found → `decide(a.id,true)`; else sets `q.status='Kiküldve'` and `render()` (no toast).
  - "Átárazás célárrésre" (`data-qreprice`, AI style), visible when status "Jóváhagyásra vár": re-runs `priceEngine({clientId, lines:[{pid,qty}], zip})`; for each line with margin < targetMargin sets `unitNet=l.rec`, `net=rec×qty`, recomputes margin; `prodNet`=Σ net; `net=prodNet+freightNet`; `gross=net×1.27`; total cost = Σ unitCost×qty + freightCost; `margin=(net−tc)/net`; removes flags whose text matches "árrés"; `q.pr=pr`; log actor "AI · Árazó", "Átárazva célárrésre: {mft(net)}", ref q.id; `render()`; toast "Átárazva. Ellenőrizze, majd hagyja jóvá." Status stays "Jóváhagyásra vár".
  - "Ügyfél elfogadta → megrendelés" (`data-qorder`, primary), visible when status "Kiküldve" and no `orderId`: `quoteToOrder(id)`; `render()`; toast "Megrendelés: {o.id}".
  - "Megrendelés {orderId}" (`data-go="orders"`), visible when `orderId` set: navigate to `orders`.

### orders — "Megrendelések"

Subtitle: "Megrendelés csak elfogadott ajánlatból vagy a vevői portálon keletkezik. A teljesítés a lezárt mérlegjegyekből számol, a túlszállítást a rendszer megállítja."

- Single panel table: Sorszám (mono id + small source quote id) | Ügyfél | Tételek · teljesítés | Szállítás | Állapot | (actions).
  - Tételek cell per line: product name; progress bar width = min(100, delivered/qty×100)%; mono "{fmt(delivered,1)} / {fmt(qty)} t"; small "tervezett fuvarban: {tn(planned)}".
  - Szállítás: "{zip} {city}" + small `ds(date)`.
- Action buttons (per row, conditional):
  - "Fuvarok ütemezése" (`data-plan`, small AI): visible when Σplanned + Σdelivered < Σline qty − 0.1. Click: `n=planTransports(id)`; `render()`; toast "{n} forduló ütemezve."
  - "TIG a lezárt fuvarokból" (`data-x="tmake"`, `data-id=order id`): visible when any transport of this order has status "Lezárva" and no `tig`. Click dispatches `X.tmake(dataset, button)` (handler defined outside this range).
  - "Számla (elfogadott TIG)" (`data-inv`): visible when any transport of the order is "Lezárva", has no `inv`, and `tigOk(f)`. Click: `invoiceOrder(id)`; `go('billing')`.
- Empty state row: "Még nincs megrendelés. Fogadjon el egy kiküldött ajánlatot."

### transport — "Fuvarok és EKÁER"

Subtitle: "Fuvaronként automatikus EKÁER-döntés indoklással. Bejelentés nélkül a fuvar nem indul; a mérlegjegy lezárja a fuvart, levonja a készletet és kiállítja a szállítólevelet."

- Selection: `sel.f` (no default; grid becomes two columns only when a transport is selected).
- Table: Fuvar (mono id) | Nap · autó (`ds(date)` + small "{truck or '—'} · {driver or 'kiosztásra vár'}") | Ügyfél · termék | Terv / nettó ("{fmt(planned,1)} / {fmt(net,1) or '—'}") | EKÁER (status pill + mono number if any) | Állapot. Row click `data-f` → `sel.f=id`; `render()`.
- Empty: table body empty, no message.

#### trDetail(f)

- h2 id + status pill; small "{clientName} · {order zip} {city} {addr} · {truck} ({driver}) · depó: {depot name}".
- AI box "EKÁER-ügyintéző · döntés": bold "Bejelentésköteles" or "Nem bejelentésköteles"; bullet list of `f.ekaer.reasons`; if number: mono "EKÁER-szám: {number} · {ds(at)} · {status}"; list of outbox jobs with `ref===f.id`: "{system} · {op} — {status pill (ok if 'Sikeres' else warn)}".
- Button "Bejelentés beküldése" / "Bejelentés újraküldése" (label depends on whether `f.ekaer.job` exists) (`data-ekaer`), visible when EKÁER required and no number. Click: if `f.ekaer.job` exists and not `f.ekaer.prepared` → `retryJob(job)` then toast "EKÁER-szám: {number}" or "Még mindig sikertelen."; else `ekaerSubmit(id,false,true)` (creates outbox job "NAV EKÁER" / "Bejelentés (létrehozás)" with payload `ekaerPayload(f)`; on success sets number "E…", status "Bejelentve", `at`; on failure status "Újrapróbálás"/"Hiba"; toasts "EKÁER-szám: {n}" or "EKÁER: {resp}"). Then `render()`.
- `<details>` "Beküldött adatok (minta)" with pretty JSON `ekaerPayload(f)`, visible when EKÁER required.
- When status ≠ "Lezárva":
  - "Autócsere": select `data-swap=f.id`, options all `S.trucks` "{id} · {type}", current truck selected. Change: `assign(f, newTruck, f.driverId || S.drivers[0].id, 'Diszpécser (ember)')`; `render()`; toast "Szabálysértés: {first hard violation}" if any else "Autó cserélve, EKÁER rendszám módosítva."
  - "Fuvar elmarad" (button bad, `data-cancel`): if EKÁER number → `ekaerCancel(f)` (job "Törlés (fuvar elmaradt)", sets ekaer status "Törölve" on success); `f.status='Törölve'`; order `planned[pid]` reduced by `f.planned` (min 0); log "Diszpécser (ember)" "Fuvar törölve, a mennyiség újra ütemezhető"; `render()`; toast "Fuvar törölve, EKÁER-bejelentés visszavonva." (no confirmation).
  - Sub-panel "Mérlegelés", note "Élesben a hídmérleg szoftveréből jön a nettó tömeg és a mérlegjegy PDF; itt kézzel szimulálható.":
    - "Állásidő (perc)": number `#wt-{id}`, default 0.
    - "Nettó tömeg (t)": number `#w-{id}`, step 0.01, default = planned + random(−0.5..0.5), 2 decimals.
    - Button "Mérlegjegy rögzítése és lezárás" (`data-close`): parses weight (comma → dot), wait minutes; `closeTransport(id, net, wait)`; `render()`. (Validation/over-delivery handling lives in `closeTransport`, outside range.)
- When status "Lezárva": "Mérlegelt nettó: **{tn(net)}** · szállítólevél: {delivery note number or '—'}".

### billing — "Szállítólevél és számla"

Subtitle: "A Billingo API v3-on keresztül: szállítólevél a fuvar lezárásakor, számla a teljesítéskor. A NAV Online Számla adatszolgáltatást a Billingo végzi."

- Selection `sel.doc` (no default; two-column only when selected).
- Table: Bizonylat (type + mono number or id) | Ügyfél · hivatkozás (clientName + small ref) | Nettó (`ft(amount)`) | Billingo (status pill) | NAV (small text `d.nav`). Row click `data-doc` → `sel.doc=id`; `render()`.
- Empty row: "Nincs bizonylat."
- Detail panel: h2 "{type} {number or id}", pill. If type "Számla": items table Tétel | Menny. ("{fmt(q,2)} t") | Egységár | Nettó (unit×qty); footer "Bruttó (27% áfa)" + gross.
  - "Jóváhagyom, kiállítás a Billingóban" (`data-issue`, primary), visible when status "Jóváhagyásra vár": if an open approval with `refId===doc.id` → `decide(a.id,true)`; else `issueInvoice(id)`; `render()`.
  - "Sztornó" (`data-storno`, small bad), visible when type "Számla" and status "Billingóban kiállítva": creates job ('Billingo','Sztornó számla', doc.id, `{endpoint:'POST /v3/documents/{id}/cancel'}`); on success: `doc.status='Sztornó'`, client (matched by name) `used -= gross` (min 0), log "Tulajdonos" "Számla sztornózva: {number}"; returns 'sztornó kiállítva'. Then `render()`; toast "Sztornó számla kiállítva." (toast shown even if job failed/queued). No confirmation.
  - h3 "POST https://api.billingo.hu/v3/documents" + pretty JSON of `cur.payload`.

### stock — "Termékkészlet"

Subtitle: "Bánya → depó → frakció bontás egyetlen mozgásnaplóból. A kezdőlap, a riport és a depónézet ugyanazt a számot mutatja."

- `grid g3`: one panel per `S.sites`: h2 site name, mono total (Σ stock of all products in its depots). Per depot: h3 depot name and table of products with non-zero stock (name | `tn`); none → "üres".
- Panel "Összesítő" with inline form `#mvform`:
  - Product select `#mv-p` (all products).
  - Type select `#mv-t`: "gyártás", "beszerzés", "helyesbítés", "saját felhasználás" (default first).
  - Quantity number `#mv-q`, step 0.1, default 100, aria-label "Mennyiség (t)". No min.
  - Submit "Könyvelés": qty forced negative if type "saját felhasználás"; `move(TODAY, pid, P(pid).depot, q, type, 'kézi')`; log "Bányamester (ember)" "{type}: {fmt(q,1)} t {name}"; `render()`; toast "Könyvelve a mozgásnaplóba." (No validation; 0 or negative accepted for other types.)
  - Table: Termék | VTSZ | Készlet | Lekötött | Szabad (total − reserved) | Minimum | Állapot (pill bad "Hiány" if free<0, warn "Minimum alatt" if free<min, ok "Rendben").
- Panel "Mozgásnapló (utolsó 12)": stock moves sorted by date desc then id desc, first 12. Columns Dátum | Termék | Depó | Típus | Mennyiség ("+"/"" sign, `fmt(qty,1)` t) | Hivatkozás (mono ref).

### store — "Üzemi raktár"

Subtitle: "Alkatrész, kenőanyag, üzemanyag. Minden kiadás egy géphez kötődik, így a költség a gépre és onnan a termékárra kerül."

- Left panel "Készlet és rendelési pont" (rows from `reorderSuggestions()`): Cikk (name + small "{supplier} · {lead} nap") | Készlet ("{qty} {unit}" (1 decimal if fractional) + small "min. {min}") | Fedezet (bar width min(100, cover/60×100)%, class bad if need and qty<min, warn if need, none otherwise; text "—" if cover>900 else "{cover} nap") | Egységár | action.
  - "Rendelés: {sugg} {unit}" (`data-po`, small AI), visible when `need`. Click: if no open approval with `refId===s.id` → `approval('po', s.id, "Beszerzés — {name}", "Készlet {qty} {unit}, fedezet {cover} nap", "Javasolt rendelés: {sugg} {unit} · {sup} · kb. {ft(sugg×price)}")`. Always toast "Jóváhagyásra küldve."; `render()`.
- Right stack:
  - Panel "Kiadás gépre", form `#issueform`: "Cikk" select `#is-s` (all `S.parts`); "Gép" select `#is-m` (all machines); "Mennyiség" number `#is-q` step 0.1 default 420; submit "Kiadás" → `issuePart(sid, qty, mid)` (rejects qty ≤ 0 or > stock with toast "Érvénytelen mennyiség vagy nincs elég készlet."); `render()`. Note: "Élesben a kúti tankolás a kútautomatából (gépazonosító + liter) automatikusan érkezik."
  - Panel "Beszerzési rendelések": table PO | Cikk (name + small supplier) | Menny. | Állapot | action. "Beérkeztetés" (`data-recv`) visible when status "Megrendelve (PO)": sets status "Beérkezett", adds qty to the part stock, log "Raktáros (ember)" "Beérkeztetve: {name} {qty}"; `render()` (no toast). Empty: "Jóváhagyott rendelés még nincs."
  - Panel "Utolsó kiadások": last 6 non-labor `S.issues` newest first: "{part name} — {qty,1} → {machine name} {ft(cost)}". Empty: "Még nincs kiadás ebben a munkamenetben."

### machines — "Gépek"

Subtitle: "Havi gépköltség: értékcsökkenés + üzemanyag + alkatrész/kiadás + útdíj. Üzemórára, tonnára és km-re vetítve."

- Read-only table from `costModel().mach`: Gép | Fázis (`stageName`) | Üzemóra | ÉCS | Üzemanyag (Ft + small liters) | Alkatrész (parts+extra) | Összesen | Ft/üzemóra | Ft/t (total ÷ stage tonnes: kitermeles/toro = Σ cm.prodT, rakodas/fuvar = cm.totSold) | Szerviz (fuvar: pill "{next} km", warn if <2000; others "{next} óra", bad <50, warn <120).
- Footer "Összesen" = Σ total.
- Note: "Saját flotta: {km} km a hónapban, teljes fuvarköltség (gép + sofőrbér) {ft(pools.fuvar)} → **{ft(ftPerKm)}/km**. Ezzel számol az árazó."
- `stageName`: kitermeles "Kitermelés", toro "Törés-osztályozás", rakodas "Rakodás-mérlegelés", fuvar "Fuvar", rezsi "Rezsi".

### reports — "Riportok és árazás"

Subtitle: "Minden riport ugyanabból a költségmodellből: amit itt lát, azzal számol az árazó is."

- Tabs (role tablist, `aria-selected`) from `sub.reports` (default 'pnl'): "Eredmény" (pnl), "Cash-flow" (cash), "Önköltség és árazás" (cost), "Munkaerő" (labor), "Gépköltség" (mach). Each tab button has `data-rep` → `sub.reports=key`; `go('reports')`. Body = `R[tab]()`. (An additional `R.cust` tab body is defined starting at line 900; its tab entry is added outside this range.)
- **pnl**: Panel "Szeptember" table: "Árbevétel — termék" (revenue − freightRev), "Árbevétel — fuvardíj", "Beszerzett áru" (−buyCost), "Kitermelés", "Törés-osztályozás", "Rakodás-mérlegelés", "Fuvar", "Rezsi (bányajáradékkal)" (negative pools); footer "Üzemi eredmény (EBIT)" = revenue − totalCost, "EBITDA" = EBIT + Σ machine dep. Panel "Hat hónap": same bar chart as dashboard + table Hónap | Árbevétel | Költség | Eredmény (first 5 from `S.pnl` ×1e6, last = cost model).
- **cash**: line chart as dashboard but mark label "biztonsági szint"; table Hét ("{ds(a)} – {ds(b).slice(6)}") | Befolyó | Kifizetés | Záró egyenleg (warn color if <15 M) | Fő tételek ("{label} {mft}" joined " · "). Note "Forrás élesben: bankszámla-egyenleg (PSD2/bankexport), Billingo kintlévőségek, ütemezett bér- és adónaptár, jóváhagyott beszerzések, nyitott rendelések teljesítési üteme."
- **cost**: Panel "Önköltség terméktonnára (szeptember)" with methodology note "Kitermelés: termelt tonnára egyenletesen · Törés-osztályozás: törési intenzitás szerint súlyozva · Rakodás és rezsi: eladott tonnára · Beszerzett áru: beszerzési ár. A gépköltség az üzemi raktár kiadásaival együtt kerül ide." Table: Termék | Beszerzés (base or "—") | Kitermelés | Törés | Rakodás | Rezsi | Önköltség (bold) | Listaár | Fedezet (pill) | Ár célárréssel (rec = ceil(u/(1−target)/10)×10) | action.
  - "Ár átvétele" (`data-setprice`, `data-v=rec`), visible when rec > list price: log "Tulajdonos" "Listaár: {name} {old} → {new}"; `p.price=rec`; `render()`; toast "Listaár frissítve; az új ajánlatok ezzel számolnak." (No approval.)
  - Inputs: "Célárrés (%)" number `#pol-target` step 1 default targetMargin×100; "Minimum árrés (%)" number `#pol-min` default minMargin×100. On change: set policy value /100; `render()` (no log, no toast).
- **labor**: Panel "Bérköltség munkakörönként": Munkakör | Fázis | Bruttó | + szocho 13% (cost) | Óra | Ft/óra; footer "Összes munkaerőköltség" total + "{ft(tot/totSold)}/eladott t". Panel "Fázisonként": single-series bar chart "Bérköltség" by stage (M Ft, 1 decimal); note "Élesben a jelenléti ív / gépnapló üzemórái alapján osztja a bért a fázisokra; a bérszámfejtésből (pl. Nexon, Kulcs-Bér) havi importtal."
- **mach**: Panel "Gépköltség megoszlása", legend "Értékcsökkenés" / "Üzemanyag" / "Alkatrész, útdíj"; stacked bar chart (h 220), labels machine ids sorted by total desc, series ÉCS (dep), Üzemanyag (fuelFt), Alkatrész (parts+extra+toll), M Ft 1 decimal; legend line "{id} = {name}" joined " · ".

### ai — "Jóváhagyások és AI"

Subtitle: "Minden folyamatlépést AI-ügynök végez; hogy önállóan vagy csak javaslatként, azt itt állítja. Minden művelet naplózott és visszakövethető."

- Left stack:
  - Panel "Döntésre vár ({n})": one AI box per approval with status "Vár": who = `kindName(kind)`, date `ds(t)`, h3 title, "Miért ember dönt: {reason}", AI text. Buttons: "Jóváhagyom" (`data-ok`) → `decide(id,true)`; "Elutasítom" (`data-no`) → `decide(id,false)`; "Ajánlat" (`data-qopen=refId`) only for kind 'quote' → open quote. Empty: "Minden döntés lezárva."
  - Panel "Lezárt döntések": alerts "{title} — {status}" with dot ok if "Jóváhagyva" else bad. Empty: "—".
- Right stack:
  - Panel "Ügynökök és önállóság": table Ügynök (bold name + small description) | Mód (select `data-mode`, aria-label "{name} módja", options "Önálló, házirenden belül" (auto), "Csak javasol" (suggest), "Kikapcsolva" (off)). Change: set agent mode; log "Tulajdonos" "{name} mód: {option text}"; toast "Mentve." (no re-render).
  - Panel "Házirend" (number inputs; change: write policy, log "Tulajdonos" "Házirend: {key} = {value}" or "…%", toast "Házirend mentve.", no re-render):
    - "Auto-küldhető ajánlat max. nettó (Ft)" `data-pol="autoQuoteMaxNet"`
    - "Auto-számla max. bruttó (Ft)" `data-pol="autoInvoiceMaxGross"`
    - "Túlszállítási tűrés (%)" `data-polpct="overDeliveryTol"` (stored /100)
    - "Fuvardíj-felár (%)" `data-polpct="freightMarkup"` (stored /100)
  - Panel "Napló": scroll box max-height 360px, first 40 `S.audit` entries: time (hu-HU, MM.DD HH:mm) · actor; text + mono ref; dot class `ai` when actor starts with "AI".
- Agents added in this range (pushed into `S.agents`): "Ajánlat-utánkövető" (followup, auto) "3 nap után emlékeztetőt küld a meg nem válaszolt ajánlatokra, 10 nap után telefonos feladatot ad az értékesítőnek."; "Követeléskezelő" (collect, auto) "Lejárt számlákra fokozatos felszólítás; 15 nap felett szállítási zárlatot javasol."; "Karbantartás-tervező" (maint, auto) "Üzemóra alapján munkalapot nyit, lefoglalja az alkatrészt, a leállást a fuvartervbe illeszti."; "Leltár-egyeztető" (stockrec, suggest) "Drónos/GPS depófelmérést összevet a könyvi készlettel; eltérésnél helyesbítést javasol."
- `kindName`: quote "Árajánlat", invoice "Számla", po "Beszerzés", price "Árazás", over "Túlszállítás", int "Integráció", dun "Követeléskezelés", inv "Leltár", wo "Karbantartás", contract "Szerződés".
- `PHASES` constant (data, rendered outside this range): [phase, agent, what it does, when a human decides]:
  1. "Ajánlatkérés beérkezése" · "Ajánlatkérés-feldolgozó" · "értelmezés, ügyfélazonosítás, hiány esetén visszakérdezés" · "<75% bizonyosság vagy új ügyfél"
  2. "Árazás" · "Árazó" · "önköltség + fuvar + kedvezmény, árrés- és hitelkeret-őr" · "limit feletti összeg, árrés a minimum alatt, lejárt tartozás"
  3. "Utánkövetés" · "Ajánlat-utánkövető" · "emlékeztető e-mail, telefonos feladat" · "10 nap után ember hív"
  4. "Megrendelés" · "Rendszer" · "elfogadó link vagy portál → megrendelés, készletfoglalás" · "készlethiány"
  5. "Fuvarszervezés" · "Fuvarszervező" · "fordulók autókra, karbantartási leállások kikerülése" · "diszpécser jóváhagyja a napi tervet"
  6. "EKÁER" · "EKÁER-ügyintéző" · "kötelezettség-döntés, bejelentés, módosítás, lezárás, törlés" · "3 sikertelen próbálkozás"
  7. "Mérlegelés, szállítólevél" · "Számlázó" · "mérlegjegyből készletcsökkenés és Billingo-szállítólevél" · "túlszállítás a tűrés felett"
  8. "Számlázás" · "Számlázó" · "teljesítésből számla, NAV-adatszolgáltatás a Billingón át" · "bruttó limit felett"
  9. "Befolyás, behajtás" · "Követeléskezelő" · "fizetés-párosítás, felszólítás, zárlat" · "szállítási zárlat elrendelése"
  10. "Termelés, készlet" · "Leltár-egyeztető" · "termelés könyvelése, depófelmérés egyeztetése" · "3% feletti eltérés"
  11. "Gépek, raktár" · "Karbantartás-tervező, Raktáros" · "munkalap, alkatrész-foglalás, rendelési javaslat" · "minden beszerzési rendelés"
  12. "Pénzügy, árazás" · "Pénzügyi elemző" · "cash-flow, árrés-figyelés, árjavaslat, kérdés-válasz" · "listaár-módosítás"

### integr — "Integrációk"

Subtitle: "Minden külső hívás (NAV EKÁER, Billingo) egy kimenő soron megy át: idempotencia-kulccsal, automatikus újrapróbálással, hiba esetén emberi döntéssel. Semmi nem vész el és semmi nem megy ki kétszer."

- Panel "Kapcsolatok": table Rendszer (bold sys + small scope) | Hitelesítés | Állapot (pill bad "Nem elérhető" if EKÁER sim down for EKÁER rows or Billingo sim down for Billingo rows, else ok "Kapcsolódva"; small last-sync text). Rows from `S.conn` (Billingo API v3, NAV EKÁER, Hídmérleg — Polgárdi, Bank (napi kivonat), E-mail — vevo@).
- Panel "Hibatűrés kipróbálása", text "Kapcsolja ki az egyik szolgáltatást, majd zárjon le egy fuvart vagy jelentsen be egy EKÁER-t: a feladat újrapróbálásra kerül, 3 hiba után döntést kér, a fuvar addig nem indulhat."
  - Checkbox `#sim-ekaer` "NAV EKÁER üzemszünet szimulálása": change → `S.sim.ekaerDown=checked`; log "Tulajdonos" "EKÁER üzemszünet szimuláció: be|ki"; `render()`.
  - Checkbox `#sim-billingo` "Billingo hiba szimulálása": same for `billingoDown`, log "Billingo hiba szimuláció: be|ki".
  - Button "Fizetések lekérdezése a Billingóból" (`data-sync`): `syncPayments()`; `render()`; toast "Fizetések szinkronizálva."
  - Button "Minden hibás feladat újrapróbálása" (`data-retryall`): `runJob(j)` for every non-"Sikeres" job; `render()`; toast "Hibás feladatok újrapróbálva."
- Panel "Kimenő sor": table Feladat (mono id) | Rendszer · művelet | Hivatkozás | Próba (attempts) | Állapot (pill ok "Sikeres", warn "Újrapróbálás", none "Sorban", bad otherwise e.g. "Hiba — döntés kell") | "Újra" button (`data-retry`) when not "Sikeres" → `retryJob(id)`; `render()`; toast "Újrapróbálva." Row click (`data-job`) → `sel.job=id`; `render()`. (The "Újra" button sits inside the row; the delegator checks `data-job` before `data-retry`, so `closest()` resolves to the button itself and the retry fires.)
- Job detail (when `sel.job` matches): h2 id; "{system} · {op} · idempotencia-kulcs: {idem}"; "Válasz: {resp or '—'}"; h3 "Kérés" + JSON payload.
- Job semantics (`runJob`, outside range, summarised for context): increments attempts; when the simulated service is down → resp "HTTP 503 — a szolgáltatás nem érhető el" (EKÁER) / "HTTP 429 — túl sok kérés, várakozás" (Billingo), status "Újrapróbálás", or "Hiba — döntés kell" at ≥3 attempts plus an 'int' approval; otherwise runs fn, status "Sikeres".

### plan — "Rendszerterv"

Subtitle: "A demó mögötti éles architektúra röviden. A teljes terv a projekt dokumentumai között: „Mine ERP 2.0 — rendszerterv”."

- Static, 3 panels (`grid g3`), no controls:
  - "Folyamat": vertical numbered flow (odd items highlighted): 1 "Ajánlatkérés (web, e-mail, telefon-jegyzet)", 2 "AI értelmezés + ügyfélazonosítás", 3 "Árazás önköltségből + fuvar", 4 "Házirend: auto-küldés vagy jóváhagyás", 5 "Elfogadó link → megrendelés", 6 "Fuvarütemezés autókra", 7 "EKÁER-döntés és bejelentés", 8 "Mérlegjegy → készletcsökkenés", 9 "Szállítólevél (Billingo)", 10 "Számla (Billingo → NAV)", 11 "Befolyás figyelése, cash-flow".
  - "Technológia" table: Adatbázis "PostgreSQL, eseménynapló (készlet- és pénzmozgás), sor-szintű jogosultság"; Backend "TypeScript (NestJS) vagy a meglévő GraphQL API rendbetéve; háttérfeladatok: Temporal / BullMQ"; Frontend "A meglévő Nuxt 3 + PrimeVue, 12 órás munkamenet, refresh token, magyar lokalizáció"; AI "Claude API eszközhívással; minden ügynök csak a saját API-végpontjait éri el; napló + emberi jóváhagyás"; Mobil "Sofőr- és mérlegkezelő PWA: fotó, aláírás, offline sor".
  - "Integrációk" table: Billingo API v3 "Partner-szinkron, szállítólevél és számla, fizetés-státusz visszaolvasás; NAV Online Számla a Billingón át"; NAV EKÁER "Gépi interfész: bejelentés, módosítás (tömeg, rendszám), lezárás; technikai felhasználó"; Hídmérleg "Mérlegszoftver export / soros port → nettó tömeg, mérlegjegy PDF"; E-mail "Microsoft 365 / Gmail webhook a vevo@ fiókra"; Bank "Napi kivonat-import, kiegyenlítés párosítás"; Üzemanyag "Kútautomata, GPS/tachográf km".

### reports / cust — "Vevői jövedelmezőség · szeptember" (begins at line 900; continued in part 3)

- Rows = `custProfit()` sorted by margin/revenue ascending. Intro text: "Fedezet = árbevétel − termék-önköltség − fuvar-önköltség − finanszírozási költség (fizetési határidő × 8,5% kamat). Ez mutatja, kinek mennyit ér valójában a kedvezmény és a hosszú fizetési határidő."

---

## Shared handlers

### render() / bindForms()

- `render()`: `renderNav()`; `#main.innerHTML = V[route]()`; `bindForms()`. Full re-render of the main area on every state change.
- `bindForms()` attaches submit listeners after each render (only if the form exists):
  - `#webform` → web inquiry creation (see inbox).
  - `#mvform` → stock movement posting (see stock).
  - `#issueform` → `issuePart(#is-s, #is-q, #is-m)`; `render()`.

### Document `change` listener (delegated)

| Trigger             | Effect                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-mode` select  | `agent.mode = value`; log "Tulajdonos" "{agent} mód: {option text}"; toast "Mentve."                                                        |
| `data-pol` input    | `S.policy[key] = +value`; log "Házirend: {key} = {value}"; toast "Házirend mentve."                                                         |
| `data-polpct` input | `S.policy[key] = value/100`; log "Házirend: {key} = {value}%"; toast "Házirend mentve."                                                     |
| `data-swap` select  | `assign(f, truck, f.driverId‖S.drivers[0].id, 'Diszpécser (ember)')`; render; toast violation or "Autó cserélve, EKÁER rendszám módosítva." |
| `data-xc` (any)     | calls `XC[key](target)` if defined (handlers defined outside this range)                                                                    |
| `#sim-ekaer`        | toggle `S.sim.ekaerDown`, log, render                                                                                                       |
| `#sim-billingo`     | toggle `S.sim.billingoDown`, log, render                                                                                                    |
| `#pol-target`       | `S.policy.targetMargin = value/100`; render                                                                                                 |
| `#pol-min`          | `S.policy.minMargin = value/100`; render                                                                                                    |

None of the change handlers validate numeric input (NaN/negative accepted).

### Document `click` listener (delegated via `closest()` on the attribute list)

Checked in this order; the first match wins:

| Key                | Effect                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-go`          | `go(value)`                                                                                                                                       |
| `data-job`         | `sel.job`; render                                                                                                                                 |
| `data-cancel`      | cancel transport (EKÁER cancel job if numbered, status "Törölve", release planned qty, log, toast "Fuvar törölve, EKÁER-bejelentés visszavonva.") |
| `data-storno`      | Billingo storno job; status "Sztornó", reduce client credit used; toast "Sztornó számla kiállítva."                                               |
| `data-x`           | `X[value](dataset, element)` if defined (e.g. `tmake`, `ask`, `claudeparse`)                                                                      |
| `data-retry`       | `retryJob`; render; toast "Újrapróbálva."                                                                                                         |
| `data-retryall`    | `runJob` on all non-successful jobs; toast "Hibás feladatok újrapróbálva."                                                                        |
| `data-sync`        | `syncPayments()`; toast "Fizetések szinkronizálva."                                                                                               |
| `data-rep`         | `sub.reports=value`; `go('reports')`                                                                                                              |
| `data-act="email"` | create e-mail inquiry, `processInquiry`, select it, toast "Feldolgozva: {status}"                                                                 |
| `data-inq`         | `sel.inq`; render                                                                                                                                 |
| `data-qopen`       | `sel.q`; `go('quotes')`                                                                                                                           |
| `data-qapprove`    | open approval → `decide(id,true)`; else `q.status='Kiküldve'`; render                                                                             |
| `data-qreprice`    | reprice to target margin (see quotes); toast "Átárazva. Ellenőrizze, majd hagyja jóvá."                                                           |
| `data-qorder`      | `quoteToOrder`; toast "Megrendelés: {id}"                                                                                                         |
| `data-plan`        | `planTransports`; toast "{n} forduló ütemezve."                                                                                                   |
| `data-inv`         | `invoiceOrder`; `go('billing')`                                                                                                                   |
| `data-f`           | `sel.f`; render                                                                                                                                   |
| `data-ekaer`       | retry existing EKÁER job (toast "EKÁER-szám: {n}" / "Még mindig sikertelen.") or `ekaerSubmit`; render                                            |
| `data-close`       | read `#w-{id}` / `#wt-{id}`; `closeTransport(id, net, wait)`; render                                                                              |
| `data-doc`         | `sel.doc`; render                                                                                                                                 |
| `data-issue`       | open approval → `decide(id,true)`; else `issueInvoice(id)`; render                                                                                |
| `data-po`          | create 'po' approval if none open; toast "Jóváhagyásra küldve."; render                                                                           |
| `data-recv`        | PO received: status "Beérkezett", part qty += PO qty, log; render                                                                                 |
| `data-ok`          | `decide(id,true)`                                                                                                                                 |
| `data-no`          | `decide(id,false)`                                                                                                                                |
| `data-setprice`    | set list price to `data-v`; log; toast "Listaár frissítve; az új ajánlatok ezzel számolnak."                                                      |

Not in the delegator list (so ignored by click): `data-mode`, `data-pol`, `data-polpct`, `data-swap`, `data-xc` (handled by change).

### decide(id, ok)

1. `a.status = ok ? 'Jóváhagyva' : 'Elutasítva'`; log "Tulajdonos" "{Jóváhagyva|Elutasítva}: {title}", ref `a.refId`.
2. If approved, by `a.kind`:
   - `quote`: quote status "Kiküldve"; linked inquiry status "Ajánlat kiküldve"; log "Rendszer" "Ajánlat e-mailben kiküldve, PDF + elfogadó link".
   - `invoice`: `issueInvoice(refId)`.
   - `po`: unshift PO `{id: nid('PO', n=>'PO-2026-'+n), sid, name, sup, qty: sugg, status:'Megrendelve (PO)'}` using the current `reorderSuggestions()` entry; log "AI · Raktáros" "Rendelés elküldve: {sup}".
   - `price`: rec = ceil(unit/(1−targetMargin)/10)×10; price raised only if rec > current; log "Rendszer" "Listaár frissítve: {name} → {price}".
   - `int`: job attempts reset to 0; `runJob(j)`.
   - `over`: order line qty for the transport's product ×1.2; log "Tulajdonos" "Pótrendelés rögzítve (+20%)".
   - `dun`, `inv`, `wo`, `contract`: no side effect here beyond the status change (any extra handling lives outside this range).
3. If rejected and kind `quote`: quote status "Piszkozat". Other kinds: status change only.
4. `render()`; toast "Jóváhagyva." or "Elutasítva."

### Live Claude (sample capability), lines 810–836

- On load: `window.claude?.use?.('sample')` → stores `SAMPLE`; re-renders if route is `dash` or `inbox`. Errors swallowed.
- `S.ask` default: `{q:'Miért alacsony a földműanyag fedezete, és mit tegyek?', a:'', busy:false}`.
- `erpTools()` (tools given to the model; all read-only, return rounded numbers):
  - `eredmeny` "Szeptemberi eredménykimutatás és költségpoolok forintban." → arbevetel, fuvarbevetel, koltsegek (pools), beszerzett_aru, uzemi_eredmeny.
  - `termek_onkoltseg` "Termékenként önköltség-bontás Ft/t, listaár, fedezet, eladott tonna." → per product termek, onkoltseg, bontas, listaar, fedezet (3 decimals), eladott_t.
  - `keszlet` "Termékkészlet depónként, lekötött és szabad mennyiség tonnában." → termek, keszlet, lekotott, minimum.
  - `cashflow` "13 hetes pénzállás-előrejelzés hetente: befolyó, kifizetés, záró egyenleg, fő tételek." → het (ISO), be, ki, zaro.
  - `gepek` "Gépenként havi költség, Ft/üzemóra és szervizig hátralévő idő." → gep, osszes, ft_uzemora, szervizig.
  - `vevok` "Vevőnként szeptemberi árbevétel, fedezet, kintlévőség, lejárt tartozás." → vevo, arbevetel, fedezet, fedezet_szazalek, lejart (from `custProfit()`).
- `X.ask` (triggered by `data-x="ask"`; its input `#ask-q` and output `#ask-out` are rendered outside this range): returns early if the question is blank or `SAMPLE` is missing. Sets `S.ask={q,a:'',busy:true}`; render; calls `SAMPLE(prompt, {tools: erpTools(), onText})`. The prompt is a Hungarian system instruction (financial analyst of Mészkő-Polgár Kft., answer in Hungarian, at most 8 sentences or a short list, concrete numbers, end with a recommended decision, rely only on tool data) + "Kérdés: {q}". Streaming text goes into `S.ask.a` and `#ask-out.textContent`. On success: log "AI · Claude (élő modell)" "Tulajdonosi kérdés megválaszolva: „{first 60 chars}”". Error messages by code: not_granted "A Claude-hívás nincs engedélyezve ehhez az oldalhoz.", rate_limited "Túl sok kérés, próbálja újra később.", tools_unavailable "Ez a nézet nem futtat eszközhívást.", otherwise `e.text` or "A válasz nem érkezett meg, próbálja újra." Finally `busy=false`; render.
- `X.claudeparse` (triggered by `data-x="claudeparse"` with `data-id=inquiry id`): returns if no `SAMPLE` or no inquiry. Sets `inq.claudeBusy=true`; render; `SAMPLE.json(prompt, {modelTier:'quick'})`. The prompt contains the product catalogue (id: name), the clients, the m³→t conversion (1,75 t/m³; M2 0/90: 1,9), the required JSON shape `{lines:[{pid,qty_t}],zip,city,addr,date,clientId,company,missing}`, the sender and the raw text.
  - Post-processing: lines are kept only if the product exists and qty_t > 0; qty is rounded; note "Claude". The date "null" string becomes null. clientId is kept only if the client exists. `conf` = (has lines + has zip + has date + has clientId)/4.
  - If the inquiry already has a quote that has no order: quote status "Felülírva"; its open approvals become "Elutasítva".
  - `processInquiry(inq, ex)`; toast "Claude újraértelmezte, az ajánlat frissült."
  - Errors: toast "A Claude-hívás nincs engedélyezve." (not_granted) or "Claude nem tudta értelmezni, a helyi értelmező eredménye marad."
  - Finally `claudeBusy=false`; render.

### custProfit() / overdueOf(name), lines 838–850

- Constants: `SHARE` (per client, the share of each product's sold tonnes: c1 {p1 .38, p2 .45, p3 .30, p6 .4}, c2 {p1 .30, p2 .25, p3 .35, p4 .40}, c3 {p5 .55, p7 .50, p4 .20}, c4 {p8 .06}); `KM` distances c1 85, c2 22, c3 38, c4 8.
- For each client: t = Σ soldT×share; product revenue = Σ q×price×(1−disc); product cost = Σ q×unit cost; trips = ceil(t/25); freight cost = trips×(km×2×ftPerKm + policy.tollPerTrip); freight revenue = freight cost×(1+freightMarkup); financing = (rev+fr)×1.27×(payDays/365)×0.085; margin = rev + fr − cost − freight cost − financing; overdue sum and max days from `overdueOf`.
- Extra row "Egyéb vevők (42 db)": the tonnes not covered by SHARE at list price; freight cost = pools.fuvar − Σ client freight costs; freight revenue = max(0, that)×(1+markup); payDays 8, no financing cost.
- `overdueOf(name)`: invoices (type "Számla") that are unpaid, not "Sztornó", for that client name, with due < TODAY → `{sum: Σgross, days: max days late, docs}`.

### runCollections(), lines 852–859 (state `S.dunning=[]`)

- No-op if the `collect` agent mode is 'off'. For each overdue unpaid, non-storno invoice: days late; level 3 if >15, 2 if >7, else 1. Skipped if a dunning entry for that doc already exists at the same or higher level.
- Texts:
  - L1 "Tisztelt Partnerünk! Az {number} számú, {ds(due)}-i esedékességű, {ft(gross)} összegű számlánk kiegyenlítése a nyilvántartásunk szerint még nem történt meg. Kérjük, ellenőrizze. Ha már utalt, tekintse tárgytalannak levelünket."
  - L2 "Tisztelt Partnerünk! Az {number} számú számla {days} napja lejárt ({ft(gross)}). Kérjük, 5 munkanapon belül rendezze, vagy jelezzen fizetési ütemezést. Ezt követően a további kiszállításokat előre utaláshoz kötjük."
  - L3 "Fizetési felszólítás: {number}, {days} nap késés. A kiszállításokat felfüggesztjük a rendezésig."
- Entry `{doc, number, client, lvl, days, txt, status, t}`. Status is "Elküldve" if lvl<3 and mode 'auto', else "Jóváhagyásra vár".
- If sent: log "AI · Követeléskezelő" "{lvl}. fokú fizetési emlékeztető elküldve: {number} ({days} nap)". Otherwise, if no 'dun' approval exists for the doc yet: approval 'dun' "Szállítási zárlat — {client}", reason "{number}: {days} napos késés, {mft(gross)}", AI "Javaslat: új fuvar csak előre utalással; felszólító levél kiküldése".

### runFollowups(), lines 861–865 (state `S.followups=[]`)

- For quotes with status "Kiküldve" and no order: age = days since `created`. Skipped if age<3, or if a follow-up exists for that quote at the same tier (3 or 10).
- age ≥ 10: kind "Telefonos feladat — értékesítő", text "Hívja fel: {client}, ajánlat {id} ({mft(net)}) {age} napja megválaszolatlan. Kérdezze meg, kell-e ármódosítás vagy más szállítási ütem."
- age 3–9: kind "Emlékeztető e-mail", text "Tisztelt Partnerünk! {ds(created)}-i, {id} számú ajánlatunk {ds(valid)}-ig érvényes. Az ajánlat elfogadása egy kattintás: [Elfogadom]. Kérdés esetén keressen bátran."
- Status "Elküldve" if the followup mode is 'auto', else "Javaslat". This function does not check for mode 'off'. Log "AI · Ajánlat-utánkövető" "{kind}: {id} ({age} nap)".

### survey(depot, pid, m3, method), line 869 (state `S.surveys=[]`)

- density = `policy.density[pid]` or `policy.density.default`; t = m3×density; book = `stockOf(pid,depot)`; diff = t − book; rel = diff/book (0 if book is 0).
- Record `{id:'FM-'+n, date:TODAY, depot, pid, m3, dens, t, book, diff, rel, method, status}`. Status "Jóváhagyásra vár" if |rel| > 0.03, else "Egyezik".
- Log "AI · Leltár-egyeztető" "Felmérés {depot}, {product}: mért {t} / könyvi {book} ({±pct})".
- If the status is not "Egyezik": approval 'inv' "Készlethelyesbítés — {product}, {depot}", reason "Felmérés szerinti eltérés {diff} ({pct}), a 3% tűrés felett". AI text "Javaslat: helyesbítés {diff}; " + (diff<0: "valószínű ok: mérlegelés nélküli saját felhasználás vagy szórás — a rakodási naplót ellenőrizni"; else "valószínű ok: könyveletlen termelés"). Returns the record.

### transfer(pid, from, to, t), line 873

- If t > stock at the source: toast "A forrásdepóban nincs ennyi készlet."; returns false.
- Otherwise two moves: `−t` 'átszállítás ki' (ref = to) and `+t` 'átszállítás be' (ref = from). Log "Bányamester (ember)" "Átszállítás: {t} {product} {from} → {to}". Returns true. There is no check for t ≤ 0.

### runMaintenance(), lines 876–881 (state `S.wos=[]`, `SEQ.WO=70`)

- No-op if the maint mode is 'off'. For each non-fuvar machine with next < 60 hours and no open (non-"Lezárva") work order:
  - kit from `WOKIT` (TOR-01: s3×60, s5×5, s6×1; DOZ-01: s8×1, s4×35; RAK-01: s4×30, s3×40; OSZT-01: s5×4, s7×1; default s4×20), each item flagged `ok` if stock ≥ q.
  - WO `{id:'ML-'+(++SEQ.WO), machine, name:"{svcEvery} órás szerviz", due: TODAY + max(1, floor(next/8)) days, kit, hours: 10 for TOR-01 else 6, status:'Tervezett'}`.
  - Log "AI · Karbantartás-tervező" "Munkalap nyitva: {machine}, {wo name}, {due}; alkatrész {lefoglalva|HIÁNYOS}". Stock is not actually reserved.

### closeWO(id), lines 882–884

- If any kit part has stock < q: toast "Hiányzó alkatrész: előbb rendelje meg."; return.
- Otherwise `issuePart` for each kit item to the machine. Labor cost = hours × (720 000×1.13/168), pushed to `S.issues` as `{sid:'s4', qty:0, labor:true}`. Then `m.next = svcEvery`, WO status "Lezárva", log "Gépszerelő (ember)" "Munkalap lezárva: {machine}, {hours} óra szerelői munka ({ft(lab)})", toast "Munkalap lezárva, alkatrész és munkaóra a gépre terhelve." No render inside the function; the caller renders.

### tankCheck(dip), lines 885–889 (state `S.tank=[]`)

- s1 = fuel tank part. diff = dip − book; rel = diff/book. Unshift `{t, book, dip, diff, rel}`. Log "AI · Raktáros" "Kúttartály mérés: {dip} l, könyvi {book} l, eltérés {diff} l ({pct})".
- If |rel| > 0.01: approval 'inv' with refId 'tank', "Üzemanyag-eltérés — kúttartály", reason "Pálcás mérés {dip} l, könyvi {book} l ({pct}), a 1% tűrés felett", AI "Javaslat: a kútautomata tankolási naplójának egyeztetése gépenként; ismétlődés esetén biztonsági kamera ellenőrzése". Book stock is unchanged.
- Otherwise book qty = dip (silent adjustment).

### Plan vs. actual and simulation, lines 891–897

- `BUDGET` monthly: kitermeles 24.0 M, toro 21.5 M, rakodas 6.4 M, fuvar 20.5 M, rezsi 26.0 M, revenue 150 M.
- `SIM` defaults `{diesel:560, wage:0, vol:0, blast:4 200 000, price:0}`.
- `withSim(fn)`: temporarily overrides the following, runs `fn`, then restores everything in `finally`:
  - `S.diesel` = SIM.diesel
  - staff gross ×(1+wage%)
  - `S.vol` entries [1] and [2] ×(1+vol%)
  - `S.overhead[0][2]` = SIM.blast
  - product prices ×(1+price%), rounded
  - machine fuel ×(1+vol%)
