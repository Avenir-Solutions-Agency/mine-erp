# Inventory part 1 (lines 1–470)

Note on line 1: it is NOT the app CSS. It is the ~41 KB artifact frame-runtime preamble (`window.__FRAME_PREAMBLE` + a minified runtime IIFE, capabilities map artifact/assets/comments/db/...). Not app logic. The app CSS lives in `<style>` lines 5–129. `<title>MINE ERP</title>` (line 2).

External assets:

- Google Fonts: Barlow Condensed 500/600/700, IBM Plex Sans 400/500/600, IBM Plex Mono 400/500.
- Scripts (lines 140–143): qrious 4.0.2 (QR generation), jsQR 1.4.0 (QR scan), pdf.js 2.16.105, xlsx (SheetJS) 0.18.5. Main inline script starts line 144, ends line 2042.

## Design tokens & styles

Design comment (line 6): left module rail + workspace; top always shows the "what waits for human decision" band. Quarry palette: limestone grey base, quarry-green accent, amber = AI.

### Color tokens (`:root`; dark via `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}` and `:root[data-theme="dark"]`, both sets identical; dark also sets `color-scheme:dark`)

| Token         | Light   | Dark    |
| ------------- | ------- | ------- |
| --bg          | #EDF0ED | #111715 |
| --surface     | #FFFFFF | #19211F |
| --surface2    | #F5F7F5 | #1F2826 |
| --ink         | #18211F | #E4EBE8 |
| --muted       | #5B6964 | #97A6A1 |
| --line        | #D3DAD6 | #2E3936 |
| --accent      | #1E6B58 | #5DC1A3 |
| --accent-soft | #DCEBE5 | #1D3A32 |
| --on-accent   | #FFFFFF | #0D1A16 |
| --ai          | #94580A | #E6A84E |
| --ai-soft     | #F6E9D3 | #3A2D18 |
| --ok          | #2B7A4B | #72CF97 |
| --ok-soft     | #DDF0E3 | #1C3527 |
| --warn        | #8A4F00 | #F0B45A |
| --warn-soft   | #FBEBD2 | #3A2B14 |
| --bad         | #B0281E | #F08A80 |
| --bad-soft    | #F7DEDB | #3D1F1C |

Chart/map series tokens (lines 105–107):

| Token   | Light   | Dark    |
| ------- | ------- | ------- |
| --c0    | #1E6B58 | #3FAE8E |
| --c1    | #B5651D | #D88A3E |
| --c2    | #3A5BA0 | #6F8FD6 |
| --c3    | #8A3B6E | #C46FA8 |
| --c4    | #5F7A1F | #93B44A |
| --c5    | #A0472E | #D27A5E |
| --c6    | #2F7F8F | #4FB3C4 |
| --water | #CFE0EA | #1F3442 |
| --road  | #C9B48A | #6B5B3A |

### Fonts, radius, base

| Token       | Value                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| --f-display | "Barlow Condensed","Arial Narrow",system-ui,sans-serif                                            |
| --f-body    | "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif                                     |
| --f-mono    | "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace                                             |
| --r         | 6px (only radius token; pills/badges use 10px, bars 3px, phone frame 18px, chips 2px, QR img 4px) |

body: bg var(--bg), color var(--ink), font-body 14px / line-height 1.5. No spacing tokens; spacing is literal px (gaps 4/6/8/10/12/14px; panel padding 16px; main padding 22px top, 60px bottom, 28px inline).

Type scale: h1 display 600 34px lh1 letter-spacing .01em text-wrap:balance; h2 display 600 21px mb10 ls .02em; h3 13px 600; `.sub` muted, max-width 72ch; `.kpi .lbl` 11px uppercase ls .07em muted; `.kpi .val` display 30px 600 tabular-nums; `.kpi .d` 12px muted; `.small` 12px muted; `.mono` mono 12px.

### Key component classes

| Class                                | Definition                                                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| .app                                 | grid, columns `232px minmax(0,1fr)`                                                                                                                                                                                                                 |
| aside                                | surface bg, right border line, padding 18px 12px, flex column gap 4, sticky top (safe-area), height 100vh, overflow auto                                                                                                                            |
| .brand                               | display 700 22px; `small` = body 11px uppercase muted ls .06em                                                                                                                                                                                      |
| .navgrp                              | 10.5px uppercase ls .09em muted, padding 12px 8px 4px                                                                                                                                                                                               |
| nav button                           | unset; flex space-between; padding 7px 10px; radius --r; 13.5px; hover surface2; `[aria-current="page"]` accent-soft bg, accent color, 600; focus-visible 2px accent outline                                                                        |
| .cnt (nav badge)                     | mono 11px, ai-soft bg, ai color, radius 10px, padding 0 7px                                                                                                                                                                                         |
| .top                                 | flex wrap, gap 12, align flex-end, space-between, mb 18                                                                                                                                                                                             |
| .grid/.g2/.g3/.g4                    | grid gap 14px; 2/3/4 equal columns                                                                                                                                                                                                                  |
| .panel (card)                        | surface bg, 1px line border, radius --r, padding 16px, min-width 0                                                                                                                                                                                  |
| .tw                                  | overflow-x auto (table wrapper)                                                                                                                                                                                                                     |
| table/th/td                          | collapse, 100%, 13px; th 10.5px uppercase ls .07em muted 500 left, padding 7px 8px, bottom border, nowrap; td padding 8px bottom border, top aligned; `td.n/th.n` right, tabular, mono 12.5px nowrap; last row no border; tfoot 600 with top border |
| .pill                                | inline-block 11px 500, padding 1px 8px, radius 10px, nowrap, default surface2/muted/line border                                                                                                                                                     |
| .pill.ok / .warn / .bad / .ai / .acc | bg `--ok-soft`/`--warn-soft`/`--bad-soft`/`--ai-soft`/`--accent-soft`, color `--ok`/`--warn`/`--bad`/`--ai`/`--accent`, border transparent                                                                                                          |
| .btn                                 | 13px 500, radius --r, padding 6px 12px, line border, surface bg; hover border muted; `.pri` accent bg/on-accent text; `.ai` ai-soft bg ai text; `.bad` bad text; `.sm` padding 3px 9px 12px                                                         |
| focus                                | btn/input/select/textarea focus-visible: 2px solid accent, offset 1px                                                                                                                                                                               |
| .row / .spread                       | flex wrap gap 8 center; spread adds space-between                                                                                                                                                                                                   |
| label.f                              | flex column gap 3, 12px muted                                                                                                                                                                                                                       |
| input/select/textarea                | 13px, surface bg, line border, radius --r, padding 6px 8px; textarea mono 12px, 100%, resize vertical; `select` max-width 100%                                                                                                                      |
| .aibox                               | line border + 3px left border --ai, surface, padding 12px 14px; `.who` 11px uppercase ls .08em ai 600                                                                                                                                               |
| .alert                               | flex gap 10, padding 9px 0, bottom border (last none)                                                                                                                                                                                               |
| .dot                                 | 8px circle, mt 6px, default muted; `.bad/.warn/.ok/.ai` set background to the token                                                                                                                                                                 |
| pre.json                             | surface2, line border, mono 11.5px, max-height 320px, scroll                                                                                                                                                                                        |
| .tabs                                | flex wrap gap 4, bottom border, mb 14; button 8px 12px 13px muted, 2px bottom border; `[aria-selected="true"]` ink, accent underline, 600                                                                                                           |
| .bar                                 | 6px tall, radius 3, surface2, min-width 60px; `i` fill accent, `.warn`/`.bad` variants                                                                                                                                                              |
| .chart                               | SVG text muted mono 10px; `.grid line` stroke line                                                                                                                                                                                                  |
| .toast                               | fixed right 16px, bottom 16px + safe-area; bg --ink, text --bg; padding 10px 14px; radius --r; 13px; max-width min(420px, 100vw-32px); z-index 9                                                                                                    |
| .stack                               | flex column gap 14                                                                                                                                                                                                                                  |
| .flow / .flow span / span.on         | process-step chips: 12px; span padding 3px 9px radius 10 surface2 line; `.on` accent-soft/accent/600                                                                                                                                                |
| .legend                              | flex gap 14 12px muted; `i` 10px square radius 2                                                                                                                                                                                                    |
| .demo                                | 11px muted dashed border, padding 2px 8px                                                                                                                                                                                                           |
| table.cal                            | calendar: bordered cells min-width 96px; `.off` surface2                                                                                                                                                                                            |
| .chips i                             | 10px color squares, gap 3                                                                                                                                                                                                                           |
| table.params                         | th wraps, min-width 110px, 10px; `th.auto` accent color; td nowrap                                                                                                                                                                                  |
| input.expiring                       | warn border + warn-soft bg                                                                                                                                                                                                                          |
| .phone                               | max-width 520px, radius 18px, padding 16px (driver-app mock)                                                                                                                                                                                        |
| .sigwrap canvas                      | signature pad: block, 100%, max 520px, dashed muted border, surface2, touch-action none                                                                                                                                                             |
| .sigimg                              | max 260px, white bg, radius 4                                                                                                                                                                                                                       |
| pre.doc / .docsheet                  | document previews: pre-wrap body 13px, surface2, padding 14, max-height 420                                                                                                                                                                         |
| .labels / .qrlabel / .qrph           | QR label grid auto-fill minmax(150px,1fr) gap 10; QR img 110x110 white bg padding 4                                                                                                                                                                 |
| .chipsq                              | flex wrap gap 6                                                                                                                                                                                                                                     |
| tr.selrow td                         | accent-soft bg (selected row)                                                                                                                                                                                                                       |
| .scanbox                             | 2px dashed accent, padding 12, mt 12                                                                                                                                                                                                                |
| svg.map text                         | 10px                                                                                                                                                                                                                                                |

### Breakpoints

| Query                          | Effect                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| max-width 980px                | .g4 → 2 cols; .g3 → 1 col                                                                                                                                                                                                       |
| max-width 760px                | .app 1 col; aside static, auto height, flex row, horizontal scroll, no right border, bottom border, padding 10px 16px; .brand and .navgrp hidden; nav flex gap 2; nav buttons nowrap; main inline padding 16px; .g2/.g4 → 1 col |
| prefers-reduced-motion: reduce | all transitions/animations none                                                                                                                                                                                                 |

## App shell & navigation

HTML (lines 131–138): `.app` > `aside` (`.brand` "Mészkő-Polgár ERP" + `<small>` "2.0 · demo környezet", `nav#nav`) + `main#main`; `div.toast#toast` hidden.

### NAV (line 459) — `[group, [[routeId, label, counterKey?]]]`

| Group       | Route id  | Label                      | Badge counter |
| ----------- | --------- | -------------------------- | ------------- |
| Áttekintés  | dash      | "Tulajdonosi irányítópult" | –             |
| Áttekintés  | ai        | "Jóváhagyások és AI"       | ap            |
| Értékesítés | inbox     | "Ajánlatkérések"           | inq           |
| Értékesítés | quotes    | "Árajánlatok"              | –             |
| Értékesítés | orders    | "Megrendelések"            | –             |
| Logisztika  | transport | "Fuvarok és EKÁER"         | –             |
| Logisztika  | billing   | "Szállítólevél és számla"  | –             |
| Logisztika  | integr    | "Integrációk"              | jobs          |
| Üzem        | stock     | "Termékkészlet"            | –             |
| Üzem        | store     | "Üzemi raktár"             | –             |
| Üzem        | machines  | "Gépek"                    | –             |
| Pénzügy     | reports   | "Riportok és árazás"       | –             |
| Projekt     | plan      | "Rendszerterv"             | –             |

- UI state (line 467): `route='dash'`, `sub={reports:'pnl'}` (per-route sub-tab), `sel={}` (selection).
- `counts()`: `ap` = approvals with status 'Vár'; `inq` = inquiries whose status does NOT match /kiküldve/i; `jobs` = jobs with status !== 'Sikeres'.
- `renderNav()`: per group `<div class="navgrp">`, per item `<button data-go="id">` with `aria-current="page"` when active, `<span class="cnt">n</span>` only if counter key exists and count > 0.
- `go(r)`: sets route, `localStorage.setItem('mperp-route', r)` in try/catch, `render()`, `window.scrollTo(0,0)`.
- Route persistence key: `mperp-route`; restored at startup (line 2040) only if `V[r]` exists: `SEEDING=true; seed(); SEEDING=false; ... localStorage.getItem('mperp-route')`.
- `toast(m)` (line 471): no-op while `SEEDING`; sets text, unhides, clears previous timer `toast._`, hides after 3400 ms.
- `stPill(s)` (line 472): `<span class="pill {class}">{esc(s)}</span>`; mapping:
  - ok: 'Kiküldve','Ajánlat kiküldve','Lezárva','Billingóban kiállítva','Bejelentve','Teljesítve','Jóváhagyva','Beérkezett','Iktatva','Elfogadva (e-aláírás)','Elfogadva (aláírt fotó)','Átvéve','Átvéve (aláírva)','Aláírva (elektronikusan)','Aláírt példány feltöltve','Exportálva','Kiegyenlítve'
  - acc: 'Megrendelve','Új','Úton','Ütemezve','Visszaigazolva','Megrendelve (PO)','Számlázva'
  - ai: 'Jóváhagyásra vár','Vár','Javasolt','Aláírásra vár'
  - warn: 'Hiányos — visszakérdezés','Bejelentendő','Kézi feldolgozásra vár','Úton / átvételre vár','Kiállításra vár','Sorban (Billingo)','Újrapróbálás','Késik'
  - bad: 'Elutasítva','Kifogásolva','Hiba','Lejárt','Sztornó'
  - neutral (''): 'Piszkozat','Tervezett','Nem szükséges','Felülírva','Törölve'; unknown status → neutral.

### Formatting helpers (lines 150–161)

- `TODAY = new Date('2026-10-03T09:00:00')` (fixed demo "now").
- `fmt(n,d=0)` hu-HU locale, d fraction digits; `ft(n)` → "… Ft"; `tn(n)` → 1 decimal + " t"; `mft(n)` → n/1e6 1 decimal + " M Ft"; `pct(n)` → n*100 1 decimal + " %"; `esc` escapes & < > "; `ds(d)` hu-HU date; `addDays(d,n)`; `iso(d)` local YYYY-MM-DD.
- `nid(k, fmtfn)`: pre-increments `SEQ[k]`, returns `fmtfn(SEQ[k])` or `k+'-'+SEQ[k]`.
- Lookups: `P(id)` product, `C(id)` client, `D(id)` depot. `mode(id)` = agent's mode.

## State model

### SEQ counters (line 160, + line 322)

`SEQ={A:88,M:41,F:612,SZL:330,SZ:412,R:57,AP:1,INQ:20,PO:18,MV:1000}`, plus `SEQ.JOB=500`. (R and PO are used outside this range.)

### ID formats

| Entity              | Format                                                                                                               | Generation   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| Quote               | `A-2026-{n}` (first new = A-2026-89); seed fixed `A-2026-81`                                                         | nid('A')     |
| Order               | `M-2026-{n}` (first = M-2026-42)                                                                                     | nid('M')     |
| Transport (forduló) | `F-2026-{n}` (first = F-2026-613)                                                                                    | nid('F')     |
| Delivery note doc   | `SZL-2026-{n}`; Billingo number `MP-SZL-2026-{SEQ.SZL padded 4}`                                                     | nid('SZL')   |
| Invoice doc         | `SZ-{n}`; Billingo number `MP-2026-{SEQ.SZ padded 4}`; seed old invoices `SZ-old-{i}` with numbers MP-2026-0398 etc. | nid('SZ')    |
| Approval            | `J-{n}` from SEQ.AP (post-increment; first J-1)                                                                      | approval()   |
| Inquiry             | `INQ-{n}` (first INQ-21)                                                                                             | ++SEQ.INQ    |
| Stock move          | `MV-{n}` (first MV-1001)                                                                                             | ++SEQ.MV     |
| Job                 | `JOB-{n}` (first JOB-501)                                                                                            | ++SEQ.JOB    |
| EKÁER number        | `'E' + last 8 digits of Date.now() + random 5-digit (10000–99999)`                                                   | ekaerSubmit  |
| Billingo partner id | `String(4100000 + floor(random*90000))`                                                                              | issueInvoice |

### S.policy

| Field               | Value                  | Meaning                                           |
| ------------------- | ---------------------- | ------------------------------------------------- |
| autoQuoteMaxNet     | 3 000 000              | net Ft above which a quote needs approval         |
| minMargin           | 0.18                   | below → bad flag                                  |
| targetMargin        | 0.25                   | recommended price + price approvals               |
| autoInvoiceMaxGross | 5 000 000              | gross Ft above which invoice needs approval       |
| overDeliveryTol     | 0.05                   | 5 % over-delivery tolerance                       |
| truckT              | 25                     | t per trip for pricing                            |
| density             | {default:1.75, p5:1.9} | t/m³ (note: lookup is by product id, so p5 = 1.9) |
| freightMarkup       | 0.12                   |                                                   |
| tollPerTrip         | 6200                   | Ft                                                |
| vat                 | 0.27                   |                                                   |
| ekaerValueLimit     | 1 000 000              | Ft                                                |
| ekaerWeightKg       | 500                    | kg                                                |

Other scalars: `royaltyRate 0.05` (bányajáradék), `diesel 560` Ft/l, `szocho 0.13` (employer tax).

### S.agents (`{id,name,does,mode}`; mode 'auto' | 'suggest' | 'off')

| id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | name                      | mode    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- |
| inbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | "Ajánlatkérés-feldolgozó" | auto    |
| quote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | "Árazó"                   | auto    |
| dispatch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | "Fuvarszervező"           | suggest |
| ekaer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | "EKÁER-ügyintéző"         | auto    |
| billing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | "Számlázó"                | auto    |
| store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | "Raktáros"                | suggest |
| cfo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | "Pénzügyi elemző"         | suggest |
| (`does` strings: inbox "Web- és e-mail ajánlatkérésből kinyeri a tételeket, címet, határidőt; ügyfelet azonosít."; quote "Önköltség + fuvar + kedvezmény alapján ajánlatot számol; árrés- és hitelkeret-őr."; dispatch "Megrendelésből fordulókat ütemez autókra, túlszállítást blokkol."; ekaer "Fuvaronként eldönti a bejelentési kötelezettséget, beküldi és rögzíti az EKÁER-számot."; billing "Lezárt fuvarból szállítólevél, teljesítésből számla a Billingón keresztül."; store "Alkatrész, olaj, üzemanyag fogyás alapján rendelési javaslat."; cfo "Heti cash-flow, árrés-figyelés, árazási javaslat a tulajdonosnak.") |

### S.sites / S.depots

- sites `{id,name,zip}`: POL "Polgárdi bánya" 8154; CSU "Csúcsoshegy" 8152; BAL "Balatonrendes" 8255.
- depots `{id,site,name}`: POL-1 "Törő alatti depó"; POL-2 "Kiszállító depó"; CSU-1 "Földműanyag depó"; BAL-1 "Külső beszerzésű depó".

### S.products `{id,name,vtsz,price(Ft/t list),factor(crusher cost weight),depot,min(t),src:'own'|'buy',buy?(Ft/t),aliases[],ekaer(bool, set true by seed)}`

| id  | name                  | vtsz    | price | factor | depot | min  | src            | aliases                              |
| --- | --------------------- | ------- | ----- | ------ | ----- | ---- | -------------- | ------------------------------------ |
| p1  | Z 0/22 zúzottkő       | 2517 10 | 6900  | 1.2    | POL-2 | 800  | own            | z 0/22, z0/22, 0/22                  |
| p2  | Z 0/63 zúzottkő       | 2517 10 | 6200  | 1.0    | POL-2 | 600  | own            | z 0/63, z0/63, 0/63                  |
| p3  | NZ 4/22 nemes zúzalék | 2517 10 | 9400  | 1.9    | POL-1 | 300  | own            | nz 4/22, nz4/22, 4/22, nemes zúzalék |
| p4  | NZ 0/4 kőliszt-homok  | 2517 10 | 5200  | 1.4    | POL-1 | 300  | own            | nz 0/4, kőliszt, 0/4                 |
| p5  | M2 0/90 földműanyag   | 2517 10 | 3600  | 0.35   | CSU-1 | 2000 | own            | m2 0/90, m2, 0/90, földműanyag       |
| p6  | 63/180 terméskő       | 2516 90 | 7800  | 0.7    | POL-1 | 150  | own            | 63/180, terméskő                     |
| p7  | Töltőanyag 0/150      | 2517 10 | 2900  | 0.2    | CSU-1 | 1000 | own            | töltőanyag, töltőföld, 0/150         |
| p8  | 0/1 mosott homok      | 2505 10 | 8500  | 0      | BAL-1 | 200  | buy (buy 6100) | mosott homok, 0/1                    |

### S.vol — September tons `[opening 09.01, produced/purchased, sold]`

p1 [1650,4800,4620]; p2 [1300,3500,3410]; p3 [420,1500,1380]; p4 [600,2100,1950]; p5 [9200,9000,7300]; p6 [380,600,540]; p7 [2100,3200,3050]; p8 [260,900,880].
Resulting stock (before seed orders): p1 1830, p2 1390, p3 540, p4 750, p5 10900, p6 440, p7 2250, p8 280.

### S.clients `{id,name,tax,zip,city,email,domain,limit(Ft),used(Ft),disc(0–1),payDays,end(bool end-user),billingoId?(set lazily)}`

| id  | name                   | tax           | zip/city            | email / domain                            | limit      | used       | disc | payDays | end   |
| --- | ---------------------- | ------------- | ------------------- | ----------------------------------------- | ---------- | ---------- | ---- | ------- | ----- |
| c1  | V-Híd Építő Zrt.       | 12345678-2-44 | 1134 Budapest       | beszerzes@vhid.hu / vhid.hu               | 20 000 000 | 14 200 000 | 0.10 | 30      | false |
| c2  | Fehérvári Útépítő Kft. | 23456789-2-07 | 8000 Székesfehérvár | beszerzes@fehervariut.hu / fehervariut.hu | 8 000 000  | 2 100 000  | 0.05 | 15      | false |
| c3  | Balaton-Mélyép Kft.    | 34567890-2-14 | 8600 Siófok         | info@balatonmelyep.hu / balatonmelyep.hu  | 6 000 000  | 5 200 000  | 0    | 15      | false |
| c4  | Kovács János           | ''            | 8156 Kisláng        | kovacs.janos@gmail.com / ''               | 0          | 0          | 0    | 0       | true  |

### S.trucks `{id(plate),name,driver,cap(t)}`

RKX-412 MAN TGS 41.480, Szabó Péter, 25; SMP-118 Volvo FMX 460, Varga László, 25; PLG-305 Scania P410, Németh Gábor, 24.

### S.machines `{id,name,stage,h(hours/month),dep(Ft),fuel(l),parts(Ft),next(h or km to service),svcEvery,src(data source),km?,toll?,tare?}`

stage ∈ kitermeles | toro | rakodas | fuvar.

| id                                        | stage      | h   | dep       | fuel l | parts     | next | svcEvery | src / extra              |
| ----------------------------------------- | ---------- | --- | --------- | ------ | --------- | ---- | -------- | ------------------------ |
| DOZ-01 Komatsu D61PX dózer                | kitermeles | 172 | 2 400 000 | 9000   | 1 600 000 | 45   | 500      | kezelői jelentés; tare 0 |
| TOR-01 Sandvik QI440 röpítőtörő           | toro       | 168 | 4 200 000 | 13500  | 5 200 000 | 12   | 250      | kezelői + rakodómérleg   |
| OSZT-01 osztályozó                        | toro       | 160 | 1 800 000 | 4000   | 800 000   | 180  | 500      | szalagmérleg             |
| RAK-01 Case 1021F homlokrakodó            | rakodas    | 181 | 1 900 000 | 8000   | 500 000   | 95   | 500      | kezelői + kanálmérleg    |
| RAK-02 homlokrakodó [típus a felmérésből] | rakodas    | 174 | 1 600 000 | 7300   | 600 000   | 310  | 500      | kezelői jelentés         |
| RAK-03 homlokrakodó [típus a felmérésből] | toro       | 160 | 1 200 000 | 6500   | 400 000   | 220  | 500      | kezelői jelentés         |
| RKX-412 MAN TGS 41.480                    | fuvar      | 198 | 1 100 000 | 6800   | 420 000   | 3100 | 30000    | km 14200, toll 640 000   |
| SMP-118 Volvo FMX 460                     | fuvar      | 186 | 1 100 000 | 6400   | 380 000   | 9800 | 30000    | km 13300, toll 600 000   |
| PLG-305 Scania P410                       | fuvar      | 171 | 950 000   | 6300   | 510 000   | 1200 | 30000    | km 12900, toll 580 000   |

### S.staff `{name,stage,gross(Ft/month),h}` (stage incl. 'rezsi')

Bányamester kitermeles 950000/168; Kotrógépkezelő kitermeles 680000/176; Fúrómester kitermeles 650000/150; Törőkezelő (2 fő) toro 1240000/336; Rakodógépkezelő rakodas 640000/181; Mérlegkezelő rakodas 520000/168; Gépkocsivezető (3 fő) fuvar 1890000/555; Gépszerelő rezsi 720000/168; Értékesítő-diszpécser rezsi 700000/168; Pénzügy-admin rezsi 620000/168; Ügyvezető rezsi 1300000/168.

### S.overhead `[name, stage, Ft/month]`

Robbantás (alvállalkozó) kitermeles 4 200 000; Bérelt dömperek és kotró kitermeles 8 600 000; Külső gépjavítás, szerviz toro 2 400 000; rezsi: Terület- és bányatelek-bérlet 2 500 000; Lízing- és hitelkamat 1 400 000; Vagyonvédelem 800 000; Jogi, munkavédelmi, bányabiztonsági szolgáltatás 900 000; Iroda, IT, telefon 1 200 000; Biztosítások 900 000; Környezetvédelmi mérések, hatóság 400 000; Telek- és területhasználat 600 000; Rekultivációs céltartalék 1 500 000; Könyvelés 350 000.

### S.parts (plant store) `{id,name,unit,qty,min,use(per 30 days),lead(days),price(Ft/unit),sup}`

| id  | name                           | unit | qty  | min  | use/30d | lead | price     | supplier             |
| --- | ------------------------------ | ---- | ---- | ---- | ------- | ---- | --------- | -------------------- |
| s1  | Gázolaj (kúttartály)           | l    | 6400 | 5000 | 57200   | 2    | 560       | MOL Nagykereskedelem |
| s2  | AdBlue                         | l    | 900  | 400  | 1500    | 3    | 180       | MOL Nagykereskedelem |
| s3  | Hidraulikaolaj HV46            | l    | 420  | 300  | 260     | 5    | 1450      | Fuchs Hungária       |
| s4  | Motorolaj 10W-40               | l    | 180  | 200  | 140     | 5    | 1650      | Fuchs Hungária       |
| s5  | Kenőzsír EP2                   | kg   | 95   | 60   | 45      | 5    | 1900      | Fuchs Hungária       |
| s6  | Ütőléc-készlet — Sandvik QI440 | klt  | 1    | 2    | 0.5     | 21   | 2 850 000 | Sandvik márkaszerviz |
| s7  | Szitabetét 22 mm               | db   | 3    | 2    | 1       | 10   | 310 000   | Haver & Boecker      |
| s8  | Szűrőkészlet — Komatsu D61PX   | klt  | 2    | 1    | 0.4     | 7    | 185 000   | Komatsu márkaszerviz |
| s9  | Gumiabroncs 23.5R25            | db   | 2    | 2    | 0.2     | 14   | 1 450 000 | Gumiker Kft.         |

### S.pnl (M Ft)

months ['ápr.','máj.','jún.','júl.','aug.']; rev [118.4,131.2,139.8,144.6,128.9]; cost [96.2,101.8,104.1,108.3,99.6].

### S.conn (integration connections `{sys,auth,scope,last}`)

- 'Billingo API v3' · 'API-kulcs (titoktárban: BILLINGO_API_KEY)' · 'partnerek, bizonylatok, fizetések' · 'ma 08:55'
- 'NAV EKÁER' · 'Technikai felhasználó + aláírókulcs (titoktárban)' · 'bejelentés, módosítás, lezárás, törlés, lekérdezés' · 'ma 08:41'
- 'Hídmérleg — Polgárdi' · 'Helyi ügynök (mérlegszoftver export)' · 'nettó tömeg, mérlegjegy PDF' · 'ma 08:58'
- 'Bank (napi kivonat)' · 'Bankexport / PSD2' · 'egyenleg, jóváírások' · 'ma 06:00'
- 'E-mail — vevo@' · 'Microsoft 365 webhook' · 'ajánlatkérések' · 'ma 09:01'

`S.sim={ekaerDown:false,billingoDown:false}` (outage simulation toggles).

### Transactional collections (initially empty, filled by seed/actions)

| Collection   | Fields                                                                                                                                                                                                                                                                                                                                | Statuses (pill)                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| stockMoves   | id MV-n, date Date, pid, depot, qty (t, signed), type 'nyitó'\|'gyártás'\|'beszerzés'\|'eladás', ref ('' or transport id)                                                                                                                                                                                                             | –                                                                                                                                                      |
| inquiries    | id INQ-n, received Date, status, channel 'E-mail'\|'Web', from, name, subject, raw; after processing: ex (parse result), conf, quoteId, reply?                                                                                                                                                                                        | 'Új'(acc), 'Kézi feldolgozásra vár'(warn), 'Hiányos — visszakérdezés'(warn), 'Jóváhagyásra vár'(ai), 'Ajánlat kiküldve'(ok)                            |
| quotes       | id, inq, clientId\|null, clientName, zip, city, addr, date (delivery Date\|null), pr (priceEngine result), created, valid (TODAY+14), status, orderId?                                                                                                                                                                                | 'Piszkozat'(neutral), 'Jóváhagyásra vár'(ai), 'Kiküldve'(ok), 'Megrendelve'(acc)                                                                       |
| orders       | id, quote, clientId, clientName, zip, city, addr, lines[{pid,qty,unitNet}], freightPerT, delivered{pid:t}, planned{pid:t}, status, date, created, invoiced? (invoice id)                                                                                                                                                              | 'Visszaigazolva'(acc), 'Ütemezve'(acc), 'Teljesítve'(ok); 'Lezárva' excluded from reservations                                                         |
| transports   | id F-…, order, clientId, clientName, pid, planned (t), truck, driver, date, status, net (t\|null), depot, ekaer{required,reasons[],value,number,status,job?,at?}, wait (min), dn (SZL id), inv (SZ id), tig (later)                                                                                                                   | 'Tervezett'(neutral), 'Úton'(acc), 'Lezárva'(ok)                                                                                                       |
| ekaer.status | –                                                                                                                                                                                                                                                                                                                                     | 'Bejelentendő'(warn), 'Nem szükséges'(neutral), 'Bejelentve'(ok), 'Újrapróbálás'(warn), 'Hiba'(bad), 'Lezárva'(ok), 'Törölve'(neutral)                 |
| docs         | delivery note: id SZL-…, type 'Szállítólevél', ref (transport id), order, clientName, amount (net*unitNet), qty, pid, status, number, nav '—', created, payload. Invoice: id SZ-…, type 'Számla', ref (comma-joined transport ids), order, clientName, amount (net), gross, items[], created, status, nav, payload, due, paid, payAt? | 'Sorban (Billingo)'(warn), 'Billingóban kiállítva'(ok), 'Piszkozat', 'Jóváhagyásra vár'(ai), 'Kiegyenlítve'(ok), 'Sztornó'(bad, excluded from overdue) |
| approvals    | id J-n, kind 'quote'\|'invoice'\|'over'\|'int'\|'price'\|'po', refId, title, reason, ai (suggestion text), status, t                                                                                                                                                                                                                  | 'Vár'(ai), 'Jóváhagyva'(ok), 'Elutasítva'(bad)                                                                                                         |
| audit        | {t Date, actor, what, ref} (unshift = newest first)                                                                                                                                                                                                                                                                                   | –                                                                                                                                                      |
| jobs         | id JOB-n, system 'NAV EKÁER'\|'Billingo', op, ref, payload, attempts, status, idem, t, fn, onFail, resp                                                                                                                                                                                                                               | 'Sorban', 'Újrapróbálás'(warn), 'Hiba — döntés kell', 'Sikeres'                                                                                        |
| pos          | purchase orders (used later)                                                                                                                                                                                                                                                                                                          | 'Megrendelve (PO)'(acc), 'Beérkezett'(ok) per pill map                                                                                                 |
| issues       | part issues {t, sid, qty, machine, cost}                                                                                                                                                                                                                                                                                              | –                                                                                                                                                      |

Derived:

- `stockOf(pid, depot?)` = sum of stockMoves qty filtered by pid (and depot if given).
- `reservedOf(pid)` = over orders with status !== 'Lezárva', sum over lines of pid of `max(0, qty - delivered[pid])`.

## Domain functions

### move(date, pid, depot, qty, type, ref)

Pushes stockMove `{id:'MV-'+(++SEQ.MV), date:new Date(date), pid, depot, qty, type, ref:ref||''}`. Module init (line 235): per product: `nyitó` +opening on 2026-09-01; on 2026-09-30 +produced as 'beszerzés' if src==='buy' else 'gyártás'; on 2026-09-30 −sold 'eladás'.

### costModel() → object (pure; reads S, includes S.issues)

1. `pools={kitermeles,toro,rakodas,fuvar,rezsi}=0`.
2. Machines: `extra = Σ issues.cost where issue.machine===m.id`; `fuelFt = m.fuel*S.diesel`; `total = dep + fuelFt + parts + (toll||0) + extra`; `pools[stage]+=total`; returns `{...m,fuelFt,extra,total,perH: total/m.h}`.
3. Labor: `cost = gross*(1+szocho)`; added to pool; `perH = cost/h`.
4. Overhead rows added to their stage pool.
5. `prodOwn` = src 'own'; `prodT[pid]=vol[1]`, `soldT[pid]=vol[2]`; `totOwn = Σ prodT own`; `totSold = Σ soldT all`; `weighted = Σ own prodT*factor`; `prodValue = Σ own prodT*price`; `royalty = prodValue*0.05` added to pools.rezsi.
6. Per product: own → `k = pools.kitermeles/totOwn`, `t = pools.toro*(factor/weighted)`, base 0; buy → base = p.buy, k=t=0. All: `r = pools.rakodas/totSold`, `o = pools.rezsi/totSold`. `parts[pid]={base,k,t,r,o}`, `unit[pid]=base+k+t+r+o` (Ft/t).
   - Note `t` = toro pool × factor/weighted (total, not divided by tons of that product — as written).
7. `km = Σ fuvar machines km`; `ftPerKm = pools.fuvar/km`.
8. `revenue = Σ soldT*price`; `buyCost = Σ buy products soldT*buy`; `freightRev = pools.fuvar*(1+0.12)`; `totalCost = Σ pools + buyCost`.
   Returns `{pools,mach,labor,unit,parts,ftPerKm,km,royalty,revenue: revenue+freightRev, freightRev, buyCost, totalCost, soldT, prodT, totSold}`.
   Seed values (computed by running lines 150–268, no issues): pools kitermeles 24 416 400, toro 30 841 200, rakodas 14 478 800, fuvar 19 335 700, rezsi 20 634 200 (incl. royalty 6 310 000); unit Ft/t ≈ p1 4428, p2 4108, p3 5549, p4 4748, p5 3067, p6 3628, p7 2827, p8 7618; ftPerKm ≈ 478.61 (km 40 400); revenue 144 604 984; totalCost 115 074 300.

### distKm(zip)

`DIST` prefix table, first match wins in order: ['815',8], ['81',18], ['80',22], ['82',55], ['84',62], ['86',38], ['85',75], ['24',45], ['20',70], ['1',85], ['9',120], ['7',110], ['6',150], ['5',190], ['4',230], ['3',180], ['2',75]; no match → 90 km.

### priceEngine({clientId, lines:[{pid,qty}], zip, delivery=true})

- `cm=costModel()`; client `C(clientId)` or fallback `{disc:0,limit:0,used:0,end:true}`.
- `totalT = Σ qty`; `km = distKm(zip)`; `trips = ceil(totalT/25)`.
- `freightCost = delivery ? trips*(km*2*cm.ftPerKm + 6200) : 0`; `freightNet = freightCost*1.12`.
- Per line: `unitNet = round(price*(1-disc))`; `unitCost = cm.unit[pid]`; `margin=(unitNet-unitCost)/unitNet`; `rec = ceil(unitCost/(1-0.25)/10)*10`; `avail = stockOf(pid) - reservedOf(pid)`; `net = unitNet*qty`.
  - flag bad if margin < 0.18: `` `${p.name}: árrés ${pct(margin)} a ${pct(minMargin)} minimum alatt (javasolt ár ${ft(rec)}/t)` ``
  - flag warn if avail < qty: `` `${p.name}: szabad készlet ${tn(avail)}, igény ${tn(l.qty)}` ``
- `prodNet = Σ net`, `net = prodNet + freightNet`, `gross = net*1.27`.
- Credit: if `!end && limit && used+gross > limit` → bad `` `Hitelkeret túllépés: felhasznált ${mft(used)} + ${mft(gross)} > keret ${mft(limit)}` ``.
- End user → ok flag 'Magánszemély: előre utalás vagy készpénz a rakodáskor'.
- If client has name: `overdueOf(name)` (line 850: unpaid, non-'Sztornó' invoices with due < TODAY; sum gross, max days overdue rounded) → if days > 7: bad `` `Lejárt tartozás: ${mft(sum)}, legrégebbi ${days} napja — szállítási zárlat javasolt` ``.
- `totalCost = Σ unitCost*qty + freightCost`.
  Returns `{lines:[{pid,qty,note?,name,unitNet,unitCost,margin,rec,net}], km, trips, freightCost, freightNet, freightPerT: totalT? freightNet/totalT : 0, prodNet, net, gross, margin:(net-totalCost)/net, flags:[{lvl:'bad'|'warn'|'ok', t}], totalT}`.

### parseInquiry(text, from) — rule-based "AI" extractor

- Split text on `\n` or `;`. For each line (lowercased), iterate products in order; first product whose alias matches regex `(?<![\d/])ALIAS(?![\d])` (case-insensitive, alias regex-escaped) wins (break). Then quantity regex `/(\d+(?:[ .]\d{3})*(?:,\d+)?)\s*(t\b|tonna|to\b|m3|m³|köbméter)/i`; number: remove spaces/dots, comma→dot, parseFloat. If unit is m3/m³/köb…: `dens = policy.density[pid] || 1.75`, note `` `${fmt(n)} m³ × ${fmt(dens,2)} t/m³` ``, `n = round(n*dens)`. Line pushed `{pid, qty:n, note}` only if a quantity matched.
- Zip/city: `/\b([1-9]\d{3})\s+([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)(?:,?\s*([^\n]{0,40}?\d+\.?))?/` → zip, city, addr (group 3 trimmed).
- Date: `/(20\d{2})[.\-]\s?(\d{1,2})[.\-]\s?(\d{1,2})/` → local Date; else /jövő\s?hét/i → TODAY+7; else /holnap/i → TODAY+1; else null.
- Company: first match `Capitalized word(s) + space + (Kft|Zrt|Bt|Nyrt).?`.
- Client match order: email domain === client.domain (non-empty); else client.name startsWith company (trailing dot removed); else client.email === from.
- `found=[lines>0, zip found, date, client]`; `conf = count(true)/4`; `missing` = labels of false ones from ['tétel','szállítási cím','határidő','ismert ügyfél'].
  Returns `{lines, zip, city, addr, date, company, clientId|null, conf, missing}`.

### log(actor, what, ref) → `S.audit.unshift({t:new Date(), actor, what, ref:ref||''})`.

### approval(kind, refId, title, reason, ai) → creates `{id:'J-'+(SEQ.AP++), kind, refId, title, reason, ai, status:'Vár', t:new Date()}`, unshift into S.approvals, returns it.

### job(system, op, ref, payload, fn, onFail) — integration outbox

- Creates `{id:'JOB-'+(++SEQ.JOB), system, op, ref, payload, attempts:0, status:'Sorban', idem, t, fn, onFail}`.
- Idempotency key: `(system==='NAV EKÁER'?'EK':'BG') + '-' + ref + '-' + first word of op lowercased` (e.g. `EK-F-2026-613-bejelentés`, `BG-SZL-2026-331-szállítólevél`).
- If an existing job with same idem has status 'Sikeres': log('Integráció', `Ismételt kérés kiszűrve (idempotencia: ${idem})`, ref) and return that job (no new job).
- Else unshift into S.jobs, `runJob(j)` synchronously, return j.

### runJob(j)

- `attempts++`. Down if (system 'NAV EKÁER' && sim.ekaerDown) or (system 'Billingo' && sim.billingoDown).
- Down: `resp` = 'HTTP 503 — a szolgáltatás nem érhető el' (EKÁER) or 'HTTP 429 — túl sok kérés, várakozás' (Billingo); `status = attempts>=3 ? 'Hiba — döntés kell' : 'Újrapróbálás'`; log('Integráció', `${system} · ${op} sikertelen (${attempts}. próbálkozás): ${resp}`, ref); call onFail(j) if set; if attempts>=3 and no approval with refId===j.id: approval('int', j.id, `Integrációs hiba — ${system}: ${op}`, `${attempts} sikertelen próbálkozás · ${resp}`, ai text: EKÁER 'Javaslat: a fuvar nem indul el. Tartós NAV-üzemszünetnél a NAV által közzétett tartalék eljárást kell követni (könyvelővel egyeztetett ügyrend szerint).' / Billingo 'Javaslat: a bizonylat sorban marad, a Billingo helyreállása után újraküldés; az ügyfél addig nem kap e-mailt.'). Returns false. No automatic retry timer: retries happen via retryJob.
- Up: `resp = fn() || '200 OK'`, status 'Sikeres', returns true.

### retryJob(id) → no-op if missing or 'Sikeres'; else runJob(j).

### processInquiry(inq, override?)

- If inbox agent mode 'off' and no override: status 'Kézi feldolgozásra vár', return.
- `ex = override || parseInquiry(inq.raw, inq.from)`; sets inq.ex, inq.conf. Log actor `override ? 'AI · Claude (élő modell)' : 'AI · Ajánlatkérés-feldolgozó'`, text `` `Értelmezve (${pct(conf)} bizonyosság): ${n} tétel, ${zip||'cím nélkül'}` ``.
- No lines: status 'Hiányos — visszakérdezés'; inq.reply = 'Tisztelt Partnerünk! Köszönjük megkeresését. Kérjük, adja meg a kért frakciót és mennyiséget (tonna vagy m³), valamint a szállítási címet, és 1 órán belül küldjük az árajánlatot.'; log 'Hiányzó tételek miatt visszakérdező e-mail piszkozat'; return.
- `clientId = ex.clientId || inq.clientId || null`; `pr = priceEngine({clientId, lines:ex.lines, zip: ex.zip||inq.zip})`.
- Quote created (`nid('A')`), clientName = client name or ex.company or inq.name or 'Új ügyfél'; valid TODAY+14; status 'Piszkozat'; unshift S.quotes; inq.quoteId.
- `needsHuman = mode('quote')!=='auto' || any bad flag || pr.net > 3 000 000 || conf < 0.75 || !clientId`.
  - True: quote & inquiry status 'Jóváhagyásra vár'; reasons = bad flag texts + `Nettó ${mft(net)} > auto-küldési limit ${mft(3e6)}` + `Alacsony értelmezési bizonyosság (${pct(conf)}): hiányzik ${missing.join(', ')}` + 'Új ügyfél: adószám/hitelkeret rögzítendő' (as applicable), joined ' · '; approval('quote', q.id, `Árajánlat ${q.id} — ${clientName}`, reasons, `Javaslat: ${blockers? 'ár módosítása a javasolt árra vagy előleg kérése' : 'küldhető'}; árrés ${pct(pr.margin)}`); log('AI · Árazó','Ajánlat összeállítva, emberi jóváhagyásra küldve').
  - False: quote 'Kiküldve', inquiry 'Ajánlat kiküldve'; log('AI · Árazó', `Ajánlat automatikusan kiküldve (${mft(net)} nettó, árrés ${pct(margin)})`).

### quoteToOrder(qid) → order | undefined

- No-op if quote missing or already has orderId.
- Order `nid('M')`: copies client/zip/city/addr; `lines = pr.lines → {pid, qty, unitNet}`; `freightPerT = pr.freightPerT`; delivered {}, planned {}; status 'Visszaigazolva'; `date = q.date || TODAY+2`.
- unshift S.orders; q.orderId; q.status 'Megrendelve'; log('Ügyfél (elfogadó link)', `Ajánlat elfogadva → megrendelés ${o.id}`).
- If dispatch mode 'auto' → planTransports. Returns o.

### ekaerCheck(order, pid, t) → `{required, reasons[], value, number:null, status}`

- `value = t * (order line unitNet || p.price)`; client fallback `{end:true}`.
- Decision chain:
  1. `!p.ekaer` → `${vtsz} nincs a bejelentésköteles termékkörben (beállítás)`; not required.
  2. `p.src==='buy'` → 'Belföldi beszerzésű áru továbbértékesítése — nem első belföldi értékesítés, nem bejelentésköteles (EU-ból beszerzett tételnél a beszerzéskor kell bejelenteni)'; not required.
  3. client end user → 'Közvetlen végfelhasználónak történő értékesítés — nem bejelentésköteles'; not required.
  4. Else reasons 'Első belföldi adóköteles értékesítés nem végfelhasználónak, saját előállítású termék' and `Bruttó tömeg ${fmt(t*1000)} kg ${>|≤} 500 kg; érték ${ft(value)} ${>|≤} 1 000 000 Ft`; `required = t*1000 > 500 || value > 1 000 000`.
- status 'Bejelentendő' if required else 'Nem szükséges'.

### planTransports(oid) → number of trips made

- `day = order.date`, truck index ti=0. Per line: `rest = qty - planned[pid] - delivered[pid]`; while rest > 0.01: truck = trucks[ti % 3], `t = min(truck.cap, rest)`; transport `nid('F')` `{order, clientId, clientName, pid, planned:t, truck:id, driver, date: day, status:'Tervezett', net:null, depot: product depot, ekaer: ekaerCheck(o,pid,t)}` unshift; planned[pid]+=t; ti++; every `trucks.length*3` (=9) trips day += 1; if ekaer required and ekaer agent 'auto' → ekaerSubmit(id, silent=true).
- order.status 'Ütemezve'; log('AI · Fuvarszervező', `${made} forduló ütemezve ${trucks.length} autóra`).

### ekaerPayload(f) — NAV EKÁER trade card (simulated)

`t = f.net ?? f.planned`:

```
{tradeType:'D', sellerVatNumber:'12312312-2-07', sellerName:'Mészkő-Polgár Kft.',
 destinationVatNumber: client.tax||null, destinationName: client.name||f.clientName,
 loadLocation:{country:'HU',postalCode:'8154',city:'Polgárdi',street:'Bánya út 1.'},
 unloadLocation:{country:'HU',postalCode:o.zip,city:o.city||'',street:o.addr||''},
 vehicle:{plateNumber:f.truck,carrierName:'Mészkő-Polgár Kft.'}, loadDate: iso(f.date),
 items:[{productName:p.name, productVtsz: vtsz with first space removed, weight: round(t*1000) kg, value: round(f.ekaer.value), currency:'HUF'}],
 orderNumber:o.id, transportId:f.id}
```

### ekaerSubmit(fid, silent)

- No-op if transport missing, not required, or already has number.
- job('NAV EKÁER','Bejelentés (létrehozás)', f.id, ekaerPayload(f), success fn: number generated, `ekaer.number`, status 'Bejelentve', `at=new Date()`, log('AI · EKÁER-ügyintéző', `Bejelentés elfogadva (szimulált NAV válasz) → ${n}`), returns 'EKÁER-szám: '+n; onFail: ekaer.status = attempts>=3 ? 'Hiba' : 'Újrapróbálás').
- `f.ekaer.job = j.id`; if not silent toast `EKÁER-szám: ${number}` or `EKÁER: ${j.resp}`.

### ekaerModify(f, what) → job('NAV EKÁER', `Módosítás (${what})`, f.id, ekaerPayload(f), fn logs `Bejelentés módosítva: ${what}`, returns 'módosítva').

### ekaerFinalize(f) → job('NAV EKÁER','Lezárás (lerakodás megtörtént)', f.id, {tradeCardNumber, unloadDate: iso(TODAY)}, fn: ekaer.status 'Lezárva', returns 'lezárva').

### ekaerCancel(f) → job('NAV EKÁER','Törlés (fuvar elmaradt)', f.id, {tradeCardNumber}, fn: ekaer.status 'Törölve', returns 'törölve').

(Note: Modify/Finalize/Cancel idempotency keys use op first word: `módosítás`, `lezárás`, `törlés`; repeated successful modify on same transport is filtered.)

### closeTransport(fid, net, wait=0)

Guards (toast + return):

- `!(net>0)` → 'Adja meg a mérlegjegy szerinti nettó tömeget.'
- EKÁER required and no number → 'EKÁER-szám nélkül a fuvar nem indulhat. Előbb jelentse be.'
- Over-delivery: `after = delivered[pid] + net`; if `after > line.qty*1.05` → approval('over', f.id, `Túlszállítás — ${f.id}`, `Megrendelt ${tn(qty)}, ezzel együtt ${tn(after)} (+${pct(after/qty-1)})`, 'Javaslat: pótrendelés kérése az ügyféltől, vagy a többlet visszarakása'); toast 'Túlszállítás: jóváhagyásra küldve, a fuvar nem zárult le.'
  Effects:
- f.net=net, status 'Lezárva', f.wait; delivered[pid]=after; `planned[pid] = max(0, planned - f.planned)`.
- move(TODAY, pid, f.depot, −net, 'eladás', f.id).
- If EKÁER required: if `|net − planned| > 0.5` t → ekaerModify(f, `tömeg ${tn(planned)} → ${tn(net)}`); then ekaerFinalize(f).
- Delivery note doc `nid('SZL')`: type 'Szállítólevél', ref f.id, amount net*unitNet, qty net, status 'Sorban (Billingo)', number null, nav '—'; payload = billingoPayload; unshift docs; f.dn.
- job('Billingo','Szállítólevél kiállítás', dn.id, payload, fn: status 'Billingóban kiállítva', number `MP-SZL-2026-` + SEQ.SZL padded 4, log('AI · Számlázó', `Szállítólevél kiállítva a Billingóban (${number}), e-mailben a vevőnek és a sofőr appjába`)).
- Completion: if every line delivered ≥ qty*0.98 → order 'Teljesítve', log('Rendszer','Megrendelés teljesítve'), `onOrderComplete(o)` (line 1378: `createTIG(o.id,'A megrendelés teljesült — TIG az összes fordulóról')`, outside range).
- toast `${f.id} lezárva · ${dn.number}`.

### billingoPayload(doc, order)

- Invoice (type 'Számla') uses doc.items; delivery note builds one item: `{name, unit_price: order line unitNet, unit_price_type:'net', quantity: doc.qty, unit:'t', vat:'27%', comment: `Fuvar: ${ref} · EKÁER: ${number||'nem köteles'}`}`.
- Returns `{partner_id: c.billingoId || '(Billingo partner_id — ügyfél-szinkronból)', block_id: '(számla bizonylattömb)' | '(szállítólevél bizonylattömb)', type: 'invoice' | '(szállítólevél típus — Billingo API v3 specifikáció szerint)', fulfillment_date: iso(TODAY), due_date: iso(TODAY + c.payDays||0), payment_method: end ? 'cash' : 'wire_transfer', language:'hu', currency:'HUF', electronic:true, items, comment: `Megrendelés: ${o.id}`}`.

### invoiceOrder(oid)

- `closed` = transports of order with status 'Lezárva', not yet invoiced (`!f.inv`) and `tigOk(f)` if defined (line 1380: TIG found by f.tig with status starting 'Elfogadva'). None → toast 'Nincs elfogadott TIG-gel igazolt, számlázatlan forduló.'
- Items: per pid sum net → `{name, unit_price: line unitNet, unit_price_type:'net', quantity: round2(q), unit:'t', vat:'27%'}`.
- Waiting time: `wmin = Σ f.wait`; `freeMin = closed.length*30`; if wmin > freeMin → item `Állásidő (${n} forduló, 30 perc/forduló díjmentes felett)` unit_price 18000 Ft/óra, quantity round2((wmin−freeMin)/60), unit 'óra'.
- Freight: if order.freightPerT → item 'Fuvardíj' unit_price round(freightPerT), quantity round2(total t), unit 't'.
- `net = Σ unit_price*quantity`; `gross = net*1.27` (hard-coded 1.27).
- Doc `nid('SZ')` → `SZ-{n}`: type 'Számla', ref joined ids, amount net, gross, items, status 'Piszkozat', nav '—', payload; unshift; mark closed f.inv.
- If gross > 5 000 000 or billing mode != 'auto': status 'Jóváhagyásra vár'; approval('invoice', inv.id, `Számla — ${clientName} (${o.id})`, `Bruttó ${mft(gross)} > automatikus számlázási limit ${mft(5e6)}`, `Ellenőrizve: ${n} lezárt fuvar, mérlegjegyek egyeznek, ár = visszaigazolt ár`); log('AI · Számlázó','Számlapiszkozat jóváhagyásra küldve'). Else issueInvoice(inv.id).
- order.invoiced = inv.id.

### issueInvoice(id)

- If client exists without billingoId: job('Billingo','Partner létrehozás', c.id, `{name, taxcode: tax||null, address:{country_code:'HU', post_code:zip, city}, emails:[email]}`, fn: billingoId = String(4100000+rand(90000)); `d.payload.partner_id = +billingoId`; returns 'partner_id …').
- d.status 'Sorban (Billingo)'; job('Billingo','Számla kiállítás', d.id, d.payload, fn: status 'Billingóban kiállítva', number `MP-2026-` + SEQ.SZ padded 4, nav 'Befogadva (NAV Online Számla, Billingón át)', due TODAY+payDays, paid false; `c.used += d.gross`; log('AI · Számlázó', `Számla kiállítva: ${number}, NAV: befogadva`)).

### syncPayments()

job('Billingo','Fizetések lekérdezése', ref `iso(TODAY)+'-'+S.jobs.length` (unique per call), payload `{endpoint:'GET /v3/documents?payment_status=paid&start_date='+iso(TODAY−7)}`, fn: for invoices `!paid && payAt && payAt <= TODAY` → paid true, status 'Kiegyenlítve', client (by name) `used = max(0, used − gross)`, log('AI · Pénzügyi elemző', `Kiegyenlítés párosítva: ${number} (${mft(gross)})`); returns `${n} kiegyenlítés`.

### reorderSuggestions() → parts with `{...s, cover, need, sugg}`

- `daily = use/30`; `cover = daily ? qty/daily : 999` (days); `need = qty < min || cover < lead+7`; `sugg = need ? ceil(max(min*2 − qty, daily*(lead+30) − qty)) : 0`.

### issuePart(sid, qty, mid)

- qty coerced to number; invalid (≤0, NaN) or > stock → toast 'Érvénytelen mennyiség vagy nincs elég készlet.'
- `s.qty -= qty`; `cost = qty*price`; push S.issues `{t, sid, qty, machine:mid, cost}` (flows into costModel machine `extra`); log('Raktáros (ember)', `${qty} ${unit} ${name} kiadva → ${machine.name} (${ft(cost)})`); toast 'Kiadva, a költség a gépre terhelve.'

### seed() (run with SEEDING=true, so toasts suppressed)

1. All products `ekaer=true`.
2. Historical invoices (`SZ-old-{i}`, type 'Számla', ref 'szeptemberi teljesítés', order '—', amount g/1.27, one item 'Szeptemberi szállítások (összesítve)' unit 'tétel', status 'Billingóban kiállítva', nav 'Befogadva', paid false, payload {note:'korábbi számla (Billingóból szinkronizálva)'}, created due−15):
   | number                                                                                             | client                 | gross  | due        | payAt      |
   | -------------------------------------------------------------------------------------------------- | ---------------------- | ------ | ---------- | ---------- |
   | MP-2026-0398                                                                                       | V-Híd Építő Zrt.       | 24.5e6 | 2026-09-25 | null       |
   | MP-2026-0402                                                                                       | Fehérvári Útépítő Kft. | 6.1e6  | 2026-10-07 | null       |
   | MP-2026-0405                                                                                       | Balaton-Mélyép Kft.    | 4.3e6  | 2026-09-28 | 2026-10-02 |
   | MP-2026-0409                                                                                       | V-Híd Építő Zrt.       | 18.2e6 | 2026-10-12 | null       |
   | MP-2026-0411                                                                                       | Fehérvári Útépítő Kft. | 3.9e6  | 2026-10-18 | null       |
   | (V-Híd overdue 8 days → >7 → overdue-block flag; Balaton-Mélyép 5 days overdue but payAt set, ≤7.) |
3. Four inquiries (received TODAY − (2−i)*0.2 days, status 'Új', id INQ-21..24), each passed to processInquiry:
   - E-mail beszerzes@fehervariut.hu, Tóth Gábor, 'Ajánlatkérés — Berényi út': 8000 Székesfehérvár, Berényi út 72.; 320 t Z 0/22, 120 t NZ 4/22; from 2026.10.12.
   - E-mail info@balatonmelyep.hu, Horváth Ádám, 'földmű anyag': 8600 Siófok, Fő utca 12.; "kb. 600 m3 M2 földműanyag" jövő héten (→ 600×1.9 = 1140 t).
   - E-mail beszerzes@fehervariut.hu, Tóth Gábor, 'Pótrendelés Seregélyesi út': 8000 Székesfehérvár, Seregélyesi út 11.; 75 t Z 0/63, 2026.10.07.
   - Web kovacs.janos@gmail.com, Kovács János, 'Webes ajánlatkérő': 0/1 mosott homok — 15 t; 8156 Kisláng, Petőfi u. 3.; 2026.10.08.
     (Raw texts verbatim at line 439–442.)
4. Running V-Híd order: priceEngine c1, 200 t p2, zip 1134; quote `A-2026-81` (Budapest, 'Váci út 45.', date TODAY−3, created TODAY−6, valid TODAY+8, 'Kiküldve'); quoteToOrder → order date set TODAY−2; planTransports (200 t → 9 trips: 25,25,24,25,25,24,25,25,2 t on RKX-412/SMP-118/PLG-305 cycling). Last 3 transports of the order (`slice(-3)` of unshift-ordered list = earliest planned): date TODAY−1, ekaerSubmit, closeTransport with nets 24.6, 25.3, 23.9. Remaining open transports: date TODAY, ekaerSubmit if no number. First 'Tervezett' found → 'Úton'.
5. Price approvals: for each product with `(price − unit)/price < 0.25`: approval('price', pid, `Árjavaslat — ${name}`, `Szeptemberi önköltség ${ft(unit)}/t, fedezet ${pct(m)} a ${pct(0.25)} cél alatt`, `Javaslat: listaár ${ft(price)} → ${ft(rec)}/t; a már kiküldött ajánlatok nem változnak`), rec = ceil(unit/0.75/10)*10. With seed costs this fires for p4, p5, p7, p8.
6. PO approvals: first 3 of reorderSuggestions with need → approval('po', sid, `Beszerzés — ${name}`, `Készlet ${qty} ${unit}, fedezet ${cover} nap, szállítási idő ${lead} nap`, `Javasolt rendelés: ${sugg} ${unit} · ${sup} · kb. ${ft(sugg*price)}`).
7. `S.audit` sorted newest first.

## External integrations simulated

All external calls go through `job()` (outbox, synchronous, idempotency key, up to 3 attempts, then approval 'int'). Outage toggles: `S.sim.ekaerDown`, `S.sim.billingoDown`.

### NAV EKÁER (system 'NAV EKÁER', idem prefix EK)

| Op                                                              | Payload                                                                                                                                                                       | On success                                 | On failure                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 'Bejelentés (létrehozás)'                                       | ekaerPayload(f) (above)                                                                                                                                                       | ekaer.number = E…, status 'Bejelentve', at | ekaer.status 'Újrapróbálás' (<3) / 'Hiba' (≥3); job 'Újrapróbálás' / 'Hiba — döntés kell'; approval at 3 |
| `Módosítás (${what})`                                           | ekaerPayload(f) with net weight                                                                                                                                               | log only                                   | job status only                                                                                          |
| 'Lezárás (lerakodás megtörtént)'                                | {tradeCardNumber, unloadDate}                                                                                                                                                 | ekaer.status 'Lezárva'                     | –                                                                                                        |
| 'Törlés (fuvar elmaradt)'                                       | {tradeCardNumber}                                                                                                                                                             | ekaer.status 'Törölve'                     | –                                                                                                        |
| Error response text: 'HTTP 503 — a szolgáltatás nem érhető el'. |
| EKÁER state transitions: 'Nem szükséges' (terminal)             | 'Bejelentendő' → 'Bejelentve' → (optional modify) → 'Lezárva'; failures 'Újrapróbálás' → 'Hiba'; cancel → 'Törölve'. Transport cannot be closed without number when required. |

### Billingo API v3 (system 'Billingo', idem prefix BG)

| Op                                                                                                                                                                                                                                        | Payload                                                                  | On success                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 'Szállítólevél kiállítás'                                                                                                                                                                                                                 | billingoPayload(dn)                                                      | dn 'Billingóban kiállítva', number MP-SZL-2026-####                                                                                    |
| 'Partner létrehozás'                                                                                                                                                                                                                      | {name, taxcode, address{country_code,post_code,city}, emails[]}          | client.billingoId, payload.partner_id numeric                                                                                          |
| 'Számla kiállítás'                                                                                                                                                                                                                        | billingoPayload(inv)                                                     | 'Billingóban kiállítva', number MP-2026-####, nav 'Befogadva (NAV Online Számla, Billingón át)', due, paid false, client.used += gross |
| 'Fizetések lekérdezése'                                                                                                                                                                                                                   | {endpoint:'GET /v3/documents?payment_status=paid&start_date=YYYY-MM-DD'} | matching invoices → 'Kiegyenlítve', client.used −= gross                                                                               |
| Error response text: 'HTTP 429 — túl sok kérés, várakozás'. Doc status before success: 'Sorban (Billingo)'.                                                                                                                               |
| Invoice transitions: 'Piszkozat' → ('Jóváhagyásra vár' if gross > 5 M or billing not auto) → 'Sorban (Billingo)' → 'Billingóban kiállítva' → 'Kiegyenlítve'. NAV Online Számla reporting is modeled as done by Billingo (nav field only). |

### Other connections (S.conn): scale (Hídmérleg — Polgárdi), bank statement, M365 e-mail webhook are listed as metadata only in this range; no functions here.
