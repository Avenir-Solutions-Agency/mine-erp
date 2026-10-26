# Mészkő-Polgár ERP 2.0 – fejlesztői specifikáció

Oct 26, 2026 · @Zsolt Rapali

## 1. Cél és hatókör

A Mészkő-Polgár Kft. (Polgárdi-Kőszárhegy mészkőbánya) teljesen új ERP-rendszerét építjük, és az első szállítandó egység a szállítólevelek és mérlegjegyek feldolgozása, nyilvántartásba vétele és azonnali EKÁER-bejelentése. Ez a dokumentum a fejlesztéshez szükséges technikai tartalmat írja le; üzleti háttér a rendszertervben (1.3) és a funkcionális felmérésben van.

**Kiinduló döntések**

- Zöld mezős fejlesztés: a régi Mine ERP kódjából és adataiból semmit nem használunk fel, adatmigráció nincs.
- Az ERP nem főkönyv: a pénzügyi tételek feladásként mennek a könyvelőprogramba; számlázás a Billingón keresztül.
- Az AI előkészít, az ember dönt; kivétel a szabályalapú, azonnali EKÁER-bejelentés (6. fejezet).
- Egy forrás az igazság: készlet a mozgásnaplóból, bevétel a lezárt szállításokból és számlákból számolódik, nem tárolt összegből.

**Fejlesztési sorrend** (a bevezetési fázisokkal egyezik):

1. Bizonylat és EKÁER: alapinfrastruktúra, azonosítás, a szükséges törzsadat, bizonylat-pipeline, Telegram-bot, mérlegintegráció, EKÁER.
2. ERP-alap: ajánlat, megrendelés, szerződés, átvételi aláírás, Billingo-számlázás.
3. Operáció: fuvarszervezés, sofőr app, iTrack, készlet, anyagmérleg, QR-raktár, gépek.
4. Automatizáció, AI és controlling.

A 4–8. fejezet az első egységet részletezi; a későbbi modulok részletes specifikációja a felmérés alatt készül, itt csak az architektúrához szükséges vázuk szerepel.

## 2. Architektúra és technológiai stack

Moduláris monolit TypeScript-monorepóban: egy NestJS API, egy Temporal-worker, egy Next.js webes felület és egy Telegram-bot szolgáltatás, közös PostgreSQL-adatbázissal. Minden funkció előbb API, utána képernyő; az AI-ügynökök ugyanezt az API-t hívják MCP-n keresztül.

&#91;embedded content: architektúra · 4 bemenet, 1 API, 4 külső szolgáltatás\]

A bemenetek csak az API-n (a Telegram a boton) át érik el a rendszert; külső rendszert kizárólag a Temporal-worker hív, így minden hívás újrapróbálható és naplózott.

| Réteg | Technológia | Megjegyzés |
| --- | --- | --- |
| Nyelv | TypeScript (strict), Node.js 22 LTS | egy nyelv mindenhol; közös Zod-sémák |
| Monorepo | pnpm workspaces + Turborepo | közös csomagok: domain, db, contracts |
| Adatbázis | PostgreSQL 17, Drizzle ORM, drizzle-kit migrációk | eseménynapló-táblák, sorszintű jogosultság, PITR-mentés |
| Backend | NestJS, REST + OpenAPI 3.1 | modulonként elkülönített domain-logika |
| Folyamatmotor | Temporal (TypeScript SDK) | EKÁER-életciklus, bizonylat-pipeline, külső hívások, ütemezett futások |
| Web | Next.js (App Router), Tailwind CSS, shadcn/ui, TanStack Query és Table | hu-HU formátumok, akadálymentes |
| Mobil | PWA ugyanabból a kódból, offline sor IndexedDB-ben | sofőr, raktáros, tulajdonosi nézet |
| Azonosítás | Keycloak (OIDC), 2FA, szerepkörök | mobilon PIN vagy QR-kártya |
| Fájlok | S3-kompatibilis objektumtár | SHA-256 lenyomat minden fájlon |
| AI | Claude API (vision + tool use), saját MCP-szerver | adat nem kerül modelltanításba |
| Telegram | grammY (Bot API), webhook mód | külön szolgáltatás, állapotmentes |
| PDF | HTML-sablon → Gotenberg | szállítólevél, ajánlat, TIG |
| Térkép | MapLibre + OpenStreetMap | későbbi fázis |
| Üzemeltetés | Docker, Hetzner (EU), Terraform, GitHub Actions | teszt és éles környezet |
| Megfigyelhetőség | OpenTelemetry, Grafana, Loki, Sentry | AI-költség is mérve |
| Titkok | Vaultwarden vagy OpenBao | soha nem a kódban vagy a repóban |

A grammY a javasolt Telegram-könyvtár; ha a fejlesztő mást szeretne, a webhook-alapú, TypeScript-natív megoldás a feltétel.

## 3. Repó-struktúra, konvenciók, fejlesztői környezet

Egy GitHub-repó, a mérleggépen futó helyi ügynök is benne van; minden szolgáltatás ugyanazokat a domain- és adatbázis-csomagokat használja.

```
mine-erp/
  apps/
    api/          NestJS REST API + MCP-szerver
    worker/       Temporal-worker (workflow-k, activity-k)
    web/          Next.js webes felület + PWA
    bot/          Telegram-bot (grammY, webhook)
    scale-agent/  helyi mérlegügynök (Node, egyetlen bináris)
  packages/
    domain/       entitások, állapotgépek, szabályok (tiszta TS, I/O nélkül)
    db/           Drizzle-séma, migrációk, seed
    contracts/    Zod-sémák, OpenAPI-generálás, kliens
    ekaer/        EKÁER XML-kliens (aláírás, séma-validálás)
    extraction/   AI-kiolvasás (prompt, séma, kiértékelő készlet)
    ui/           közös shadcn-komponensek
  infra/          Terraform, docker-compose, Grafana-dashboardok
  docs/           ADR-ek, futtatási útmutatók
```

**Konvenciók**

- Kód és azonosítók angolul; felhasználói szövegek magyarul, i18n-kulcsokon keresztül (hu-HU alapértelmezett).
- Pénz egész fillérben (bigint), tömeg egész kilogrammban, idő UTC-ben tárolva, Europe/Budapest zónában megjelenítve.
- Azonosítók UUIDv7; az üzleti sorszámok (pl. SZ-2026-000123) külön, adatbázis-szekvenciából, hézag nélkül.
- Conventional Commits, trunk-alapú fejlesztés rövid életű ágakkal, PR-enként automatikus ellenőrzés.
- ESLint + Prettier, `tsc --noEmit` a CI-ban; nincs `any` a domain-csomagban.
- Minden fontos döntés rövid ADR-ben a `docs/adr` alatt.

**Helyi környezet:** `docker compose up` indítja a PostgreSQL-t, a Temporalt (dev server), a Keycloakot, a MinIO-t (S3) és a Gotenberget; `pnpm dev` a többit. A seed parancs teszt-törzsadatot és mintabizonylatokat tölt be. A Telegram-bot helyben egy külön fejlesztői botnévvel fut, tunnelen keresztüli webhookkal.

## 4. Adatmodell

Az első egységhez tizenegy tábla kell; mind UUIDv7 kulccsal, `created_at`, `updated_at`, `created_by` mezővel, és minden írás eseményt ad az `event_log`-ba. A lenti mezőlista a minimum, a felmérés pontosítja.

| Tábla | Fontos mezők | Megjegyzés |
| --- | --- | --- |
| `customer` | név, adószám, székhely, Billingo-partnerazonosító, aktív | Billingo-partnerlistából importálva |
| `delivery_address` | customer\_id, név, cím, irányítószám, település, adószám (ha más cég) | EKÁER lerakóhely |
| `product` | név, frakciókód (pl. 22/63), VTSZ, egységár, EKÁER-köteles (bool), aktív | VTSZ 2517 / 2516 / 2505 kör |
| `vehicle` | rendszám (normalizált), országkód, típus (vontató, pótkocsi), saját vagy idegen, átlagos tára | 20 saját teherautó + idegen fuvarozók |
| `person` | név, szerepkör (sofőr, mérlegkezelő, admin …), Keycloak-azonosító, Telegram user\_id | egy tábla minden dolgozóra |
| `document` | típus (mérlegjegy, szállítólevél), forrás (scale, telegram, upload), fájl kulcsa, SHA-256, feltöltő, beérkezés ideje, státusz | egy beérkezett bizonylat (fotó vagy mérlegadat) |
| `extraction` | document\_id, modell, prompt-verzió, nyers kimenet (JSON), mezőnkénti érték + bizonyosság, időtartam, költség | több is lehet egy bizonylathoz (újrafuttatás) |
| `shipment` | nyilvántartási sorszám, mérlegjegyszám, szállítólevélszám, customer\_id, delivery\_address\_id, vontató és pótkocsi, sofőr, mérlegelés ideje, státusz | a nyilvántartás központi rekordja |
| `shipment_item` | shipment\_id, product\_id, bruttó, tára, nettó (kg), érték (Ft) | több tétel is lehet egy fuvaron |
| `ekaer_report` | shipment\_id, tcn (EKÁER-szám), státusz, utolsó requestId, kérés és válasz XML (objektumtárban), funcCode, reasonCode, figyelmeztetések | egy szállításhoz egy aktív bejelentés |
| `event_log` | entitás, azonosító, esemény, szereplő (ember, ügynök, rendszer), előtte-utána JSON, ok, idő | csak hozzáfűzés, nem módosítható |

**Állapotok**

- `document`: `received` → `extracted` → `linked` (shipmenthez kötve) | `needs_review` | `rejected` | `duplicate`.
- `shipment`: `draft` → `registered` → `ekaer_reported` (vagy `ekaer_not_required`) → `delivered` → `closed`; mellékesen `needs_review`, `cancelled`.
- `ekaer_report`: `pending` → `submitted` → `active` (S) → `finalized` (F); `failed`, `deleted` (I).

**Szabályok az adatbázisban:** egyedi kulcs a (mérlegjegyszám, év) párra és a fájl SHA-256-ra; a nettó = bruttó − tára CHECK-feltétel; egy shipmenthez legfeljebb egy nem törölt `ekaer_report`. A készletmozgás (`stock_movement`) a 3. fázisban érkezik, de a shipment már most úgy tárol, hogy visszamenőleg generálható legyen belőle.

## 5. Bizonylat-feldolgozó pipeline (1. prioritás)

Három bemenet (mérlegadat, Telegram-fotó, feltöltés) egyetlen Temporal-workflow-ba fut: `ProcessDocumentWorkflow(documentId)`. A workflow idempotens, bármelyik lépésnél újraindítható, és minden lépése eseményt ír. Célidő: fotótól EKÁER-számig 60 másodperc, mérlegadattól 30 másodperc.

&#91;embedded content: bizonylat-pipeline · 3 bemenet, 1 döntési pont\]

A három csatorna ugyanabba a sorba fut; ami nem felel meg minden szabálynak, emberi ellenőrzésre megy, és javítás után a validálástól folytatódik.

**Lépések (activity-k)**

1. `ingest` – a fájl vagy a mérlegadat az objektumtárba kerül, SHA-256 számolás, `document` rekord. Azonos lenyomatnál `duplicate`, a feladó visszajelzést kap.
2. `extract` – csak fotónál: Claude vision-hívás strukturált kimenettel (tool use, JSON-séma a `packages/extraction` alatt). Minden mezőhöz érték és 0–1 bizonyosság. Mérlegadatnál a mezők közvetlenül leképeződnek, bizonyosság 1.
3. `normalize` – rendszám nagybetű, szóköz és kötőjel nélkül; tömegek kg-ra; dátum Europe/Budapest zónából UTC-be; frakciónév a terméktörzs aliaslistája alapján.
4. `validate` – szabályok a `packages/domain` alatt, tiszta függvényként (a lista lent).
5. `link` – a mérlegjegy és a szállítólevél párosítása (bizonylatszám, rendszám, ±30 perc), újat hoz létre vagy meglévő `shipment`-hez köt; ha van megrendelés vagy fuvar, ahhoz is.
6. `register` – nyilvántartási sorszám kiadása, `shipment.status = registered`.
7. `ekaer` – ha a termék köteles és minden feltétel teljesül, child workflow: `EkaerReportWorkflow` (6. fejezet). Egyébként `ekaer_not_required` vagy `needs_review`.
8. `notify` – visszaigazolás a forráscsatornán (Telegram-válasz, webes értesítés), kivételkor az EKÁER-adminnak is.

**Validációs szabályok** (mindegyik kóddal és magyar üzenettel tér vissza)

- kötelező mezők: bizonylatszám, dátum és idő, vontató rendszáma, vevő, termék, bruttó, tára, nettó;
- mezőnkénti bizonyosság legalább 0,95 (konfigurálható);
- nettó = bruttó − tára, ±20 kg tűréssel; a nettó 1 és 45 000 kg között;
- rendszám, vevő, szállítási cím és termék ismert a törzsben (fuzzy egyezés legfeljebb javaslat, sosem automatikus);
- a mérlegelés ideje nem jövőbeli és nem régebbi 24 óránál;
- nincs ugyanilyen bizonylatszám az évben, és nincs aktív EKÁER-bejelentés a szállításra.

**Kiolvasás minősége:** a `packages/extraction` alatt címkézett mintakészlet (valós mérlegjegy- és szállítólevél-fotók, legalább 100 darab) és kiértékelő szkript, amely mezőnkénti pontosságot számol. Prompt- vagy modellváltás csak akkor mehet élesre, ha a pontosság nem romlik. A mintakészlet a mai Viber-csoport fotóiból indul, az ügyfél hozzájárulásával.

**Ellenőrzési sor (webes felület):** a `needs_review` tételek listája; bal oldalt az eredeti fotó nagyíthatóan, jobb oldalt a kiolvasott űrlap, a bizonytalan mezők kiemelve. Mentés után a workflow a `validate` lépéstől folytatódik (Temporal signal).

## 6. EKÁER-integráció

A NAV EKÁER-felülete szinkron XML-over-HTTPS API (nem SOAP, nincs WSDL): a create válasza azonnal visszaadja az EKÁER-számot (`tcn`), ha a validáció és a biztosíték-foglalás sikeres. A kliens a `packages/ekaer` csomagban él, XSD-validálással küldés előtt.

| Elem | Érték |
| --- | --- |
| Éles végpont | `https://import.ekaer.nav.gov.hu/TradeCardManagementService/customer/{művelet}` |
| Teszt végpont | `https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer/{művelet}` |
| Műveletek | `manageTradeCards` (create, modify, delete, finalize, correction), `queryTradeCards` |
| Kérés | HTTP POST, `content-type: text/xml`, siker = HTTP 200 + `funcCode` OK vagy WARNING |
| Azonosítás | felhasználónév, jelszó SHA-512 hash-e, adószám első 8 jegye, `requestSignature` |
| Aláírás | SHA-512( requestId + UTC időbélyeg `yyyyMMddHHmmss` formában + titkos aláírókulcs ) |
| requestId | legfeljebb 50 karakter, felhasználónként egyedi; időbélyeg 24 órán belüli, nem jövőbeli |
| Hozzáférés | elsődleges felhasználó Ügyfélkapun, alatta másodlagos felhasználó az ERP-nek, saját aláírókulccsal |
| Tesztkörnyezet | levélben igényelhető a NAV-tól (cégnév, cím, telefon, e-mail, adószám) |

Forrás: [NAV EKÁER technikai GYIK](https://nav.gov.hu/ekaer/interfesz/gyik-/technikai-kerdesek) és az [EKAERManagementService 2.0 leírás](https://ekaer.nav.gov.hu/faq/content/uploads/2014/12/EKAERManagementService_2.0_en.pdf). Fejlesztés előtt a [NAV dokumentációs oldalán](https://nav.gov.hu/ekaer/interfesz/dokumentacio-) ellenőrizni kell a legújabb interfészverziót és XSD-t.

**Leképezés (belföldi értékesítés, `tradeType = D`)**

- eladó: Mészkő-Polgár Kft. adatai; felrakóhely (`loadLocation`): a bánya címe;
- címzett és lerakóhely: `customer` + `delivery_address`;
- jármű: `vehicle/plateNumber` (vontató), `vehicle2/plateNumber` (pótkocsi), országkóddal;
- `loadDate`: a mérlegelés ideje; `orderNumber`: a nyilvántartási sorszám (erre keresünk vissza);
- tételek: `productVtsz`, `productName`, `weight` (kg, nettó), `value` (Ft, nettó érték az árlistából vagy a megrendelésből), `tradeReason = S` (értékesítés).

**`EkaerReportWorkflow`**

1. Kötelezettség-döntés: termék `ekaer_required` jelzője és a szállítás tömege/értéke alapján (a küszöbértékek konfigurációban, mert a jogszabály változhat).
2. Automatikus beküldés, ha az 5. fejezet minden szabálya teljesül és a házirendben az auto-EKÁER be van kapcsolva; egyébként `needs_review`, és az EKÁER-admin egy kattintással küldi.
3. Create küldése új requestId-val. Időtúllépés vagy hálózati hiba esetén újraküldés előtt kötelező `queryTradeCards` az `orderNumber`-re, hogy ne szülessen dupla bejelentés.
4. Siker: `tcn`, státusz, `tcnValidityStart`/`End` mentése, a figyelmeztetések (`NAVValidations`, `warnings`) naplózva és az adminnak jelezve.
5. Hiba: `reasonCode` és `msg` mentése, értesítés; legfeljebb 3 automatikus újrapróbálkozás csak átmeneti hibánál, validációs hibánál soha.
6. Lezárás (`finalize`, `arrivalDate`-tel): a szállítás teljesülésekor; az 1. fázisban ütemezett lépés várható érkezéssel, az admin felülbírálhatja. A lezárási határidőt a hatályos szabály szerint kell beállítani.
7. Módosítás, törlés és korrekció (`modify`, `delete`, `correction`) csak emberi jóváhagyással, kötelező indoklással (a `*ModReasonText` mezőkbe).

**Két biztonsági szabály:** a teljes kérés- és válasz-XML az objektumtárba kerül (bizonyítékként), a jelszó és az aláírókulcs nélkül; az auto-EKÁER egy házirend-kapcsolóval azonnal kikapcsolható, ekkor minden tétel jóváhagyásra vár.

## 7. Telegram-bot és mérlegintegráció

A Telegram-bot és a helyi mérlegügynök csak bemeneti csatorna: mindkettő egy `document` rekordot hoz létre és elindítja a `ProcessDocumentWorkflow`-t, üzleti logikát nem tartalmaz.

### Telegram-bot (`apps/bot`)

- **Regisztráció:** a megrendelő nevére, BotFatherrel; a token a titoktárban. Fejlesztéshez külön teszt-bot.
- **Webhook:** HTTPS-végpont, `secret_token` beállítva, a `X-Telegram-Bot-Api-Secret-Token` fejléc ellenőrizve; az update-et a bot azonnal sorba teszi és 200-zal válaszol.
- **Csoport:** a botnak látnia kell minden fotót, ezért a privacy módot ki kell kapcsolni (BotFather `/setprivacy`), vagy adminná kell tenni a csoportban. Csak az engedélyezett `chat_id`-kból fogad; a csoport supergrouppá alakulásakor (`migrate_to_chat_id`) az azonosító frissül.
- **Feladó:** `from.id` → `person.telegram_user_id`. Ismeretlen feladó bizonylatát nem dolgozza fel, az adminnak jelez.
- **Bemenetek:** `photo` (a legnagyobb felbontású változatot tölti le), `document` (kép vagy PDF, tömörítés nélkül, ez a jobb minőség), album (`media_group_id`: külön bizonylatonként, de egy üzenetben visszaigazolva). Letöltés `getFile`-lal, utána azonnal a saját objektumtárba.
- **Válasz:** a bot az eredeti üzenetre válaszol (`reply_to`) egy „Feldolgozás…” üzenettel, majd ugyanazt szerkeszti a végeredményre: „Rögzítve: SZ-2026-001234 · 22/63 · 24 360 kg · ABC123 → EKÁER: …” vagy „Ellenőrzésre vár: a rendszám nem olvasható”.
- **Parancsok:** `/allapot <bizonylatszám>`, `/ma` (napi összesítő, csak felelősöknek), `/segitseg`.
- **Privát üzenet:** ugyanígy működik, ha a feladó nyilvántartott.
- **Adat:** a Telegram-szerveren hagyott üzeneteket nem tároljuk tovább, a mi rendszerünkben csak a fájl, a feladó, a chat és az üzenetazonosító marad.

### Mérlegintegráció (`apps/scale-agent`)

A mérlegszoftver típusa még ismeretlen, ezért az ügynök adapter-alapú; az első adaptert a felmérés után írjuk meg. Lehetséges források, előnyben részesítési sorrendben:

1. a mérlegszoftver saját API-ja vagy webhookja;
2. olvasás a mérlegszoftver adatbázisából (csak olvasási jog, ODBC vagy natív kliens);
3. exportált fájl (CSV, XML, PDF) figyelése egy mappában;
4. végső esetben a mérlegjegy-nyomtatás elfogása (virtuális nyomtató → PDF → kiolvasás).

A soros porti mérőfej-olvasás csak tömeget ad, vevőt és terméket nem, ezért önmagában nem elég. Az ügynök egyetlen futtatható állomány Windows-szolgáltatásként; helyi SQLite-pufferrel offline is gyűjt, HTTPS-en, eszközenkénti tokennel küld az API-nak (`POST /scale/tickets`, idempotencia-kulcs = mérlegjegyszám). Percenként szívverést küld; 5 perc kiesés után riasztás megy, és a mobil felület a fotós utat ajánlja.

## 8. További modulok áttekintése

A későbbi modulok részletes specifikációja a felmérés alatt készül; az adatmodellt és a modulhatárokat már most úgy kell kialakítani, hogy ezek ráépülhessenek. A demo v6 (meszko-polgar-erp-demo.netlify.app) üzleti logikája (árazás, fuvar-javaslatmotor, költségmodell, bérszámítás) referencia és teszteset, kódja nem használható fel közvetlenül.

| Modul | Fő entitások | Kulcsszabály | Fázis |
| --- | --- | --- | --- |
| Ajánlatkérés, árajánlat | inquiry, quote, quote\_item, price\_list | auto-ajánlat csak ismert ügyfélnek, 3 M Ft alatt, ≥ 75% bizonyossággal | 2 |
| Megrendelés | order, order\_item, project | túlszállítási tűrés 5%, felette jóváhagyás | 2 |
| Szerződés | contract, contract\_template | iktatás SHA-256 lenyomattal | 2 |
| Szállítólevél-állapotgép, átvétel | shipment (bővítve), signature | 24 óránál régebbi aláíratlan jelzés | 2 |
| Számlázás | invoice, invoice\_item, payment | számla csak elfogadott TIG-ből; Billingo a NAV-adatszolgáltató | 2 |
| Fuvarszervezés, sofőr app | trip, trip\_plan, driver\_shift | minden fuvar „Javasolt”, amíg a diszpécser el nem fogadja | 3 |
| Készlet, anyagmérleg, minőség | site, depot, stock\_movement, shift\_log, sieve\_test | készlet csak mozgásnaplóból számolva | 3 |
| QR-raktár, gépek, munkalapok | part, part\_movement, machine, work\_order | kiadás csak célhoz (gép, munkalap, projekt) | 3 |
| Bejövő számlák, bank, könyvelési feladás | supplier\_invoice, bank\_statement, ledger\_export | gépazonosító vagy költséghely nélkül nem könyvelhető | 4 |
| Bérelőkészítés | attendance, payroll\_prep | export csak vezetői jóváhagyás után | 4 |
| Riportok, controlling, „Ma” nézet | nézetek és materializált nézetek | egy költségmodell minden riport mögött | 4 |
| Kérdezze az ERP-t | – (csak olvasó MCP-eszközök) | csak olvas, döntést javasol | 4 |

A négy kiegészítő modul (hulladéklerakó, mérleg rendszámfelismeréssel, gépüzemnapló, gépkezelő- és szerelő-mobil) külön specifikációban szerepel, de ugyanebbe a monorepóba és adatbázisba kerül; a rendszámfelismerés a `document` és `vehicle` táblákra épül.

## 9. AI-ügynökök, MCP-szerver, házirend

Az ügynök nem külön rendszer: Temporal-workflow, amely a Claude API-t hívja, és kizárólag az ERP saját MCP-szerverén keresztül, a hozzá rendelt eszközökkel ér el adatot. Az 1. fázisban két ügynök kell: a bizonylat-feldolgozó (kiolvasás, párosítás) és az EKÁER-ügyintéző.

**MCP-szerver (`apps/api` része)**

- Az eszközök az OpenAPI-műveletekből készülnek, ugyanazzal a jogosultság- és validációs réteggel, mint a webes hívások.
- Minden ügynöknek saját szolgáltatásfiókja van Keycloakban, szűk szerepkörrel; az eseménynaplóban a szereplő az ügynök neve.
- Író eszköz hívása előtt a házirend-motor dönt: engedélyezett, jóváhagyásra vár, vagy tiltott.

**Házirend-motor**

- Szabályok adatbázisban, verziózva, a webes felületen szerkeszthetők (rendszerüzemeltetői szerepkör).
- Ügynökönkénti mód: `autonomous` (házirenden belül), `suggest_only`, `off`. Induláskor minden `suggest_only`, kivéve a bizonylat-feldolgozót és az EKÁER-ügyintézőt, amelyek a pilot után a jóváhagyott szabályokon belül önállóak.
- Mindig emberi jóváhagyás kell: EKÁER módosítás és törlés, a szabályoknak nem megfelelő EKÁER-beküldés, nagy összegű utalás, szerződésmódosítás, limit feletti árengedmény, kritikus könyvelési tétel, beszerzési rendelés.
- Jóváhagyási tétel: Temporal signalra váró workflow, a webes „Jóváhagyások” listában egy kattintással elfogadható vagy elutasítható, indoklással.

**Claude API használata**

- Vision-képes Claude-modell, a modellazonosító konfigurációban (nem a kódban); strukturált kimenet tool use-szal, séma szerinti validálással.
- Prompt és séma verziózva; az `extraction` tábla rögzíti, melyik verzió futott.
- Minden hívás tokenszáma és költsége naplózva; havi AI-költségkeret konfigurálható, 80%-nál riasztás, a keret elérésekor az ügynökök `suggest_only` módra váltanak.
- Személyes adat csak a feladathoz szükséges mértékben megy a modellnek; az API-adatok nem kerülnek modelltanításba.

## 10. Külső integrációk

Minden kimenő hívás közös mintát követ: Temporal-activity idempotencia-kulccsal, legfeljebb 3 automatikus próbálkozás exponenciális várakozással, utána jóváhagyási tétel a hibaüzenettel. Minden integrációhoz szerződésteszt tartozik rögzített mintaválaszokkal.

| Rendszer | Irány | Mire | Fázis |
| --- | --- | --- | --- |
| NAV EKÁER | ki | bejelentés, lezárás, módosítás, törlés, lekérdezés (6. fejezet) | 1 |
| Telegram Bot API | be/ki | bizonylatfotók, visszaigazolás, értesítés | 1 |
| Mérlegszoftver | be | mérlegjegy-adatok a helyi ügynökön át | 1 |
| Claude API | ki | kiolvasás, ügynökök | 1 |
| Billingo API v3 | ki/be | partnerek (import már az 1. fázisban), szállítólevél, számla, sztornó, fizetések | 1 (partnerimport), 2 |
| NAV Online Számla | be | státusz és bejövő számlák lekérdezése (az adatszolgáltatást a Billingo végzi) | 2 |
| iTrack WebService | be | pozíció, útvonal, események, üzemanyag | 3 |
| Kútautomata | be | literek gépenként | 3 |
| E-mail (M365 vagy Gmail) | be/ki | ajánlatkérések, kimenő levelek | 4 |
| Bank | be | kivonat-import, kiegyenlítés párosítása | 4 |
| Könyvelőprogram | ki | számlák, fizetések, bérköltség, készletérték költséghellyel | 4 |
| Bérszámfejtő program | ki | jóváhagyott bérelőkészítés CSV-ben | 4 |

## 11. Biztonság, jogosultság, GDPR

Alapelv: legkisebb jogosultság, minden titok a titoktárban, minden művelet visszakereshető.

- **Azonosítás:** Keycloak OIDC, irodai felhasználóknak kötelező 2FA; mobilon PIN vagy QR-kártya rövid életű tokennel.
- **Szerepkörök (1. fázis):** rendszerüzemeltető, EKÁER-admin, irodai felhasználó, mérlegkezelő, sofőr, csak olvasó vezető, ügynök (szolgáltatásfiók). A jogosultság az API-rétegben dől el, nem a felületen.
- **Titkok:** EKÁER-felhasználó jelszava és aláírókulcsa, Telegram-token, Claude API-kulcs, Billingo-kulcs, mérlegügynök-tokenek a titoktárban; a szolgáltatások induláskor olvassák be. Naplóba, hibaüzenetbe, Sentry-be titok nem kerülhet (redakciós szűrő).
- **Adat:** adatbázis és objektumtár EU-ban (Hetzner), titkosítva tárolva; TLS mindenhol; napi mentés + PITR, a visszaállítás negyedévente tesztelve.
- **Napló:** az `event_log` csak hozzáfűzhető (adatbázis-jogosultsággal is kényszerítve); belépések és jogosultságváltozások külön audit-naplóban.
- **GDPR:** a Megrendelő az adatkezelő, mi adatfeldolgozók vagyunk (4. sz. melléklet). Személyes adat: dolgozók neve, telefonszáma, Telegram-azonosítója, rendszámok, bizonylatfotók. Törlési és exportálási funkció személyenként; a bizonylatok megőrzési ideje a számviteli szabályokhoz igazodik, konfigurálható.
- **Biztonsági ellenőrzés:** függőségvizsgálat (Dependabot vagy Renovate), statikus elemzés a CI-ban, az élesítés előtt OWASP ASVS 2. szintű önellenőrzés.

## 12. Infrastruktúra, CI/CD, megfigyelhetőség

Két környezet (teszt és éles) Hetzner EU-régióban, Terraformmal leírva; minden szolgáltatás Docker-konténerben fut.

- **Éles:** Docker Compose vagy k3s (a fejlesztő választja, ADR-ben indokolva); menedzselt vagy saját üzemeltetésű PostgreSQL PITR-rel; Temporal saját üzemeltetésben (vagy Temporal Cloud, ha a költség ezt indokolja); S3-kompatibilis objektumtár; fordított proxy automatikus TLS-sel (Caddy vagy Traefik).
- **CI (GitHub Actions):** lint, típusellenőrzés, unit- és integrációs tesztek, migráció-ellenőrzés, konténerkép-építés minden PR-on.
- **CD:** a fő ág automatikusan a tesztkörnyezetbe megy; élesre címkézett kiadás kerül kézi jóváhagyással, visszagördíthetően. Az adatbázis-migrációk csak előrefelé kompatibilisek (expand–contract).
- **Megfigyelhetőség:** OpenTelemetry trace-ek az API-ból, a workerből és a botból; Grafana-dashboard a bizonylat-pipeline-ra (beérkezett, feldolgozott, ellenőrzésre váró, átlagos átfutás), az EKÁER-hívásokra (siker, hiba, válaszidő) és az AI-költségre; Loki a naplóknak, Sentry a hibáknak.
- **Riasztások:** EKÁER-hiba vagy 2 percnél régebb óta várakozó beküldés; mérlegügynök-kiesés 5 percnél tovább; Telegram-webhook hibái; AI-keret 80%-a; mentés hibája. Csatorna: e-mail és egy külön Telegram-riasztási csoport.

## 13. Tesztelés és Definition of Done

A domain-szabályok (validáció, állapotgépek, EKÁER-leképezés) tiszta függvények, unit-tesztekkel 90% feletti lefedettséggel; a többi rétegre integrációs és végponttól végpontig tartó teszt.

| Szint | Eszköz | Mit fed le |
| --- | --- | --- |
| Unit | Vitest | validációs szabályok, állapotátmenetek, EKÁER-XML generálás és aláírás (a NAV GYIK példájával ellenőrizve) |
| Integráció | Vitest + Testcontainers (PostgreSQL), Temporal test env | workflow-k teljes útja, újraindítás, idempotencia |
| Szerződés | rögzített kérés-válasz párok | EKÁER, Telegram, Billingo, mérlegadapter |
| Kiolvasás | címkézett mintakészlet + kiértékelő szkript | mezőnkénti pontosság, regresszió prompt- vagy modellváltáskor |
| E2E | Playwright | fotó feltöltése → ellenőrzési sor → nyilvántartás → EKÁER-szám (EKÁER-tesztkörnyezet ellen) |

**Az 1. fázis kész, ha:**

- [ ] Telegram-fotó, webes feltöltés és legalább egy mérlegadapter működik éles-szerű környezetben;
- [ ] a címkézett mintakészleten a kötelező mezők pontossága legalább 98%, és az automatikusan továbbengedett tételek között nincs hibás;
- [ ] az EKÁER-tesztkörnyezetben create, finalize, modify, delete és query is sikeres, dupla bejelentés időtúllépéskor sem keletkezik;
- [ ] fotótól EKÁER-számig a medián átfutás 60 másodperc alatt van;
- [ ] a pilot a mai Viber-gyakorlattal párhuzamosan, legalább két hétig fut eltérés nélkül;
- [ ] dashboardok, riasztások, mentés-visszaállítás tesztje, futtatási útmutató a `docs` alatt.

**Minden feladatra (Definition of Done):** kód-review, zöld CI, tesztek az új logikára, OpenAPI frissítve, migráció visszafordítható, eseménynaplózás megvan, a tesztkörnyezetben kipróbálva, a felhasználói szövegek magyarul.

## 14. Nyitott technikai kérdések

Az első három kérdés blokkolja az 1. fázist, ezért ezekkel kell kezdeni.

- [ ] Milyen hídmérleg és mérlegszoftver van, ki a szállítója, van-e API, adatbázis-hozzáférés vagy export? (mérlegadapter)
- [ ] EKÁER-tesztkörnyezet igénylése levélben a NAV-tól, és másodlagos EKÁER-felhasználó létrehozása az ERP-nek a megrendelő elsődleges felhasználója alatt.
- [ ] Mely termékek EKÁER-kötelesek (VTSZ 2517, 2516, 2505), és milyen tömeg- vagy értékküszöbbel? A könyvelő vagy adótanácsadó állásfoglalása kell.
- [ ] Mintafotók: legalább 100 valós mérlegjegy- és szállítólevél-fotó a mai Viber-csoportból a kiolvasás fejlesztéséhez és méréséhez.
- [ ] Mi van pontosan a mérlegjegyen és a szállítólevélen (mezők, sorszámozás), és melyik készül előbb?
- [ ] Ki posztolja a bizonylatot és mikor: a mérlegkezelő mérlegeléskor, vagy a sofőr? (EKÁER-időzítés)
- [ ] Telegram-csoport tagjai, a dolgozók Telegram-fiókjai, a bot neve.
- [ ] Idegen fuvarozók járművei: honnan jön a rendszám és az országkód?
- [ ] Billingo-hozzáférés a partnerlista importálásához.
- [ ] Az EKÁER-bejelentésben az érték forrása: árlista vagy megrendelés szerinti ár?
- [ ] Éles üzemeltetés: Docker Compose vagy k3s, saját vagy menedzselt PostgreSQL és Temporal (ADR-ben döntendő).

**Források:** [NAV EKÁER technikai GYIK](https://nav.gov.hu/ekaer/interfesz/gyik-/technikai-kerdesek) · [EKAERManagementService 2.0 leírás](https://ekaer.nav.gov.hu/faq/content/uploads/2014/12/EKAERManagementService_2.0_en.pdf) · [NAV EKÁER interfész-dokumentáció](https://nav.gov.hu/ekaer/interfesz/dokumentacio-) · rendszerterv 1.3 · funkcionális felmérés.
