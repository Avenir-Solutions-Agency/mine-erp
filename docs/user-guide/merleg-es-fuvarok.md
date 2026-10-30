# Felhasználói útmutató: Mérleg és Fuvarok és EKÁER

Állapot: 2026-10-30. A NAV-kapcsolat jelenleg **szimulált** (`EKAER_SIMULATE=true`). A bejelentések nem mennek el a valódi NAV-hoz, de minden lépés ugyanúgy működik.

## Tartalom

0. [A rendszer elindítása (fejlesztői gépen)](#0-a-rendszer-elindítása-fejlesztői-gépen)
1. [Fiók létrehozása és belépés](#1-fiók-létrehozása-és-belépés)
2. [Első beállítás: vevők és termékek](#2-első-beállítás-vevők-és-termékek)
3. [Mérleg: egy szállítás lemérése](#3-mérleg-egy-szállítás-lemérése)
4. [Mérleg: EKÁER kézzel](#4-mérleg-ekáer-kézzel)
5. [Mérleg: sztornó](#5-mérleg-sztornó)
6. [Fuvarok és EKÁER: Szállítások](#6-fuvarok-és-ekáer-szállítások)
7. [Fuvarok és EKÁER: Összesítő és Excel](#7-fuvarok-és-ekáer-összesítő-és-excel)
8. [Fuvarok és EKÁER: Papír jegyek](#8-fuvarok-és-ekáer-papír-jegyek)
9. [Fuvarok és EKÁER: Szabályok (automatikus EKÁER)](#9-fuvarok-és-ekáer-szabályok-automatikus-ekáer)
10. [Gyakori helyzetek](#10-gyakori-helyzetek)

---

## 0. A rendszer elindítása (fejlesztői gépen)

Amíg nincs éles szerver, a rendszer a fejlesztői gépen fut, több részből. Mindegyik külön terminálablakban fut, és ablakonként nyitva kell maradnia. Minden parancsot a projekt mappájából (`Meszko-Polgar-ERP`) adjon ki.

| Rész | Mire való | Cím |
|---|---|---|
| Temporal és Gotenberg (Docker) | háttérfolyamatok vezérlése, PDF-készítés | Temporal felület: `http://localhost:8233` |
| API | az üzleti logika, az adatbázis kezelése | `http://localhost:4000` |
| Worker | háttérmunka: EKÁER-bejelentés, fotók kiolvasása | nincs felülete |
| Web | a felület, amit böngészőben használ | `http://localhost:3000` |
| Mérlegszimulátor | a valódi mérlegfej helyett küld súlyt | a terminálban fut |

Előfeltétel: a `.env.local` fájl ki van töltve a `.env.example` alapján, és a Docker Desktop fut.

### Indítás sorrendben

1. **Docker-szolgáltatások** (egyszer, utána a háttérben futnak):
   ```
   docker compose -f infra/docker-compose.yml up -d
   ```
2. **Adatbázis-migráció**: új verzió letöltése után mindig futtassa le. Ha nincs új migráció, nem csinál semmit.
   ```
   cd packages/db && node --env-file=../../.env.local scripts/migrate.ts && cd ../..
   ```
3. **API** (1. ablak). Lefordítja a kódot, és változásra magától újraindul:
   ```
   pnpm --filter @mine-erp/api dev
   ```
   Akkor jó, ha a `http://localhost:4000/health` válasza `{"data":{"status":"ok"}}`.
4. **Worker** (2. ablak):
   ```
   pnpm --filter @mine-erp/worker start
   ```
   Akkor jó, ha kiírja: `worker listening on task queue "documents"`. Szimulált NAV-nál előtte ez is megjelenik: `EKÁER: simulated NAV (EKAER_SIMULATE=true)`.
   - A worker kódváltozásra **nem** indul újra magától. Új verzió után állítsa le (`Ctrl+C`), és indítsa el újra.
5. **Web** (3. ablak):
   ```
   pnpm --filter @mine-erp/web dev
   ```
   Utána nyissa meg a `http://localhost:3000` címet.
6. **Mérlegszimulátor** (4. ablak), lásd lent.

### A mérlegszimulátor használata

Amíg a valódi mérlegfej nincs bekötve, a szimulátor játssza a mérleget. Másodpercenként négyszer küld súlyt az API-nak, és a Mérleg oldal „Élő súly” mezője ezt mutatja.

1. Indítás:
   ```
   pnpm --filter @mine-erp/scale-agent simulate
   ```
2. A terminálban ez a sor frissül folyamatosan:
   ```
     38560 kg · kapcsolódva · [1] üres [2] rakott [0] le [q] kilép
   ```
   Ha `az API nem érhető el` látszik, az API nem fut. Ha `API hiba 401`, a `SCALE_AGENT_TOKEN` nem egyezik a `.env.local`-ban.
3. Billentyűk (a szimulátor ablakában nyomja meg, Enter nem kell):
   - **1**: üres kamion áll fel (kb. 14 200 kg);
   - **2**: rakott kamion áll fel (kb. 38 560 kg);
   - **0**: a kamion lehajt (üres mérleg);
   - **q**: kilépés.
4. Felhajtás után a súly kb. 2,5 másodpercig ingadozik. Ilyenkor a Mérleg oldal **Mozgásban** állapotot mutat, utána **Stabil** lesz. Mérni csak Stabil állapotban lehet.

**Egy teljes mérlegelés kipróbálása a szimulátorral:**

1. A szimulátorban nyomja meg az **1**-et (üres kamion behajt), és várja meg a **Stabil** állapotot.
2. A Mérleg oldalon töltse ki a rendszámot, a terméket és a vevőt, majd kattintson az **Első mérés** gombra.
3. A szimulátorban nyomja meg a **2**-t (a kamion megrakva visszaáll), és várja meg a **Stabil** állapotot.
4. A Nyitott mérlegelések listában kattintson a **Második mérés** gombra. Nettó: kb. 24 360 kg.
5. Nyomja meg a **0**-t (a kamion lehajt).

**EKÁER-hiba kipróbálása:** szimulált NAV-nál a `HIBA` kezdetű rendszámot (pl. `HIBA123`) a NAV elutasítja. Így ki lehet próbálni a **Sikertelen** állapotot és az **Újrapróbálás** gombot.

### Leállítás

- Az API, a worker, a web és a szimulátor ablakában nyomjon `Ctrl+C`-t.
- A Docker-szolgáltatások leállítása: `docker compose -f infra/docker-compose.yml down`. Nem kötelező, nyugodtan futhatnak tovább.

## 1. Fiók létrehozása és belépés

### Fiók létrehozása (rendszergazda végzi)

Az ERP-ben nincs nyilvános regisztráció: biztonsági okból csak a rendszergazda hozhat létre fiókot (docs/SECURITY.md). Új kolléga fiókja így készül:

1. Lépjen be a Supabase felületére (`https://supabase.com/dashboard`), és nyissa meg a projektet.
2. Bal menü: **Authentication**, majd **Users**.
3. Kattintson az **Add user** gombra, és válassza a **Create new user** lehetőséget.
4. Töltse ki:
   - **Email address**: a kolléga munkahelyi e-mail-címe.
   - **Password**: ideiglenes jelszó, legalább 12 karakter.
   - Pipálja be az **Auto Confirm User** mezőt. Így nem kell megerősítő e-mail.
5. Kattintson a **Create user** gombra.
6. Az e-mail-címet és az ideiglenes jelszót **külön csatornán** adja át: a jelszót például jelszókezelőben vagy szóban, ne ugyanabban az e-mailben.

A fiók megszüntetése: ugyanitt a felhasználó sorában **Delete user**. A naplóban a korábbi műveletei megmaradnak.

### Első belépés

1. Nyissa meg a `http://localhost:3000` címet.
2. Adja meg az e-mail-címét és az ideiglenes jelszót.
3. A rendszer QR-kódot mutat. Telepítsen hitelesítő alkalmazást a telefonjára (pl. Google Authenticator vagy Microsoft Authenticator), és olvassa be vele a kódot.
4. Írja be az alkalmazás által mutatott 6 jegyű kódot. Ezzel kész a kétlépcsős azonosítás (2FA), ami minden irodai fióknál kötelező.

### Későbbi belépés

1. Nyissa meg a `http://localhost:3000` címet.
2. Adja meg az e-mail-címét és a jelszavát.
3. Írja be a hitelesítő alkalmazás aktuális 6 jegyű kódját.
4. Ha egy oldalon a „jelentkezzen be” üzenet jelenik meg, a belépés lejárt: lépjen be újra.

Ha elvesztette a telefonját, vagy elfelejtette a jelszavát, szóljon a rendszergazdának.

## 2. Első beállítás: vevők és termékek

A mérlegeléshez, a szállítólevélhez és az EKÁER-hez a vevő és a termék adatai a törzsadatokból jönnek. Ezt elég egyszer beállítani, utána csak akkor kell hozzányúlni, ha új vevő vagy termék jön.

### Vevő felvétele

1. Bal menü: **Mérleg**, majd a **Vevők** fül.
2. Kattintson a **Hozzáadás** gombra.
3. Töltse ki a mezőket:
   - **Név** (kötelező), pl. `V-Híd Építő Zrt.`
   - **Adószám** `12345678-1-12` formában. Az EKÁER-hez kötelező.
   - **Cím** „irányítószám település, utca” formában, pl. `1146 Budapest, Hermina út 17.` Az EKÁER-hez kötelező.
   - **Megjegyzés** (nem kötelező).
4. Mentse el.

### Termék felvétele

1. **Mérleg**, majd a **Termékek** fül, és a **Hozzáadás** gomb.
2. Töltse ki a mezőket:
   - **Név** (kötelező), pl. `M2 földmű anyag osztályozott 0/90`
   - **Frakció**, pl. `0/90`
   - **VTSZ**: 8 számjegy, pl. `25171010`. Az EKÁER-hez kötelező.
   - **Ár (Ft/t)**, pl. `9500`. Ebből számolja a rendszer az EKÁER-értéket.
   - **EKÁER-köteles**: pipálja be, ha a termék szállítását be kell jelenteni.
3. Mentse el.

### Módosítás, inaktiválás

- **Szerkesztés**: a sor végén lévő gombbal.
- **Inaktiválás**: az inaktív vevő vagy termék nem választható új mérlegelésnél. Nem törlődik, mert a régi mérlegjegyek hivatkoznak rá. Az **Aktiválás** gomb visszahozza.

## 3. Mérleg: egy szállítás lemérése

Bal menü: **Mérleg**, majd a **Mérlegelés** fül.

### Mit lát az oldalon

- **Élő súly**: a mérlegről jövő tömeg. Kézzel senki nem írhat be tömeget. Állapotai:
  - **Stabil**: a súly nyugalomban van, lehet mérni.
  - **Mozgásban**: a jármű még mozog. A mérés gombjai ilyenkor nem működnek.
  - **Üres**: nincs jármű a mérlegen.
  - **Nincs jel**: a mérlegfej nem válaszol. Ellenőrizze a mérlegprogramot és a kapcsolatot.
- **Mutatók**: Ma lezárva, Ma nettó összesen, Nyitott mérlegelés.

### A) Normál mérlegelés (két mérés)

**Behajtáskor, első mérés:**

1. A jármű álljon fel a mérlegre, és várja meg, hogy az élő súly **Stabil** legyen.
2. Az **Új mérlegelés** panelen töltse ki:
   - **Rendszám** (kötelező). A felajánlott listából is választhat.
   - **Pótkocsi**, ha van.
   - **Termék** és **Vevő**. Ha bármelyik hiányzik, a szállítás nem kerül automatikusan nyilvántartásba.
   - **Megjegyzés** (nem kötelező).
3. Kattintson az **Első mérés** gombra.
4. Értesítés jelenik meg: `MJ-2026-000123: első mérés rögzítve`. A mérlegelés a **Nyitott mérlegelések** listába kerül.

**Kihajtáskor, második mérés:**

1. A jármű álljon fel újra, és várja meg a **Stabil** állapotot.
2. A **Nyitott mérlegelések** listában keresse meg a rendszámot.
3. Kattintson a **Második mérés** gombra.
4. A rendszer ezt csinálja:
   - kiszámolja a bruttót, a tárát és a nettót;
   - lezárja a mérlegelést, és a sor a **Mai mérlegjegyek** listába kerül;
   - ha volt vevő és termék, nyilvántartásba veszi a szállítást (SZ-2026-…);
   - elkészíti és archiválja a mérlegjegy PDF-et;
   - ha az automatikus EKÁER be van kapcsolva és minden adat megvan, bejelenti az EKÁER-t (lásd a 9. pontot).

### B) Mentett tárával (egy mérés)

Akkor használja, ha a jármű üres tömege (tárája) már el van mentve.

1. Rakottan álljon a mérlegre, és várja meg a **Stabil** állapotot.
2. Töltse ki az **Új mérlegelés** panelt, és pipálja be a **Mentett tárával (egy mérés)** mezőt.
3. Kattintson az **Első mérés** gombra. A mérlegelés azonnal lezárul, a tára mellett „mentett” felirat jelenik meg.

### Mérlegjegy és szállítás

A **Mai mérlegjegyek** listában minden lezárt mérlegelésnél ezt látja:

- **Mérlegjegy**: a PDF megnyitása és nyomtatása. A PDF egyszer készül el, és utána nem változik.
- **Szállítás**: az SZ-szám. Ha üres, de a mérlegelés lezárt, a **Nyilvántartásba vétel** gombbal pótolhatja. Ehhez előbb legyen vevő és termék.
- **EKÁER**: a bejelentés állapota (lásd a 4. pontot).
- **Állapot**: **Lezárva** vagy **Sztornó**.

## 4. Mérleg: EKÁER kézzel

Ha nincs bekapcsolva az automatikus bejelentés, vagy hiányzott valami, az EKÁER-t kézzel lehet kezelni. A gombok a **Nyitott mérlegelések** soraiban vannak, a lezártaknál pedig az EKÁER-oszlop mellett.

### Bejelentés

1. Kattintson az **EKÁER bejelentés** gombra.
2. Adja meg:
   - **Tervezett tömeg (kg)**: első mérés után becsült érték; lezárt mérlegelésnél a nettó.
   - **Érték (Ft)**: nettó tonna × ár.
3. Kattintson a beküldés gombra. Az állapot sorban ez lesz:
   - **Bejelentés folyamatban**;
   - utána **Bejelentve**, alatta az EKÁER-számmal (`E…`).

Ha valami hiányzik (pl. nincs adószám, VTSZ vagy vevőcím), a rendszer magyarul kiírja, mi a hiány. Pótolja a törzsadatban, majd próbálja újra.

### Ha a bejelentés sikertelen

- Az állapot **Sikertelen**, alatta az ok, pl. a NAV hibakódja.
- Kattintson az **Újrapróbálás** gombra. A rendszer előbb megkérdezi a NAV-ot, hogy megvan-e már a bejelentés, így nem lesz dupla.

### Súly módosítása

Ha a bejelentett tömeg eltér a mért nettótól, a gomb kiemelve jelenik meg: **EKÁER súly ≠ nettó: módosítás**.

1. Kattintson rá (vagy az **EKÁER súly módosítása** gombra).
2. Adja meg az **Új tömeg (kg)** és az **Indoklás** mezőt.
3. Küldje be. Közben az állapot **Súlymódosítás folyamatban**, utána újra **Bejelentve**.

### Lezárás (lerakodás után)

1. Kattintson az **EKÁER lezárás** gombra.
2. A **Lerakodás ideje** mezőben alapból a mostani idő áll. Ha a lerakodás máskor volt, írja át. Jövőbeli idő nem adható meg.
3. Küldje be. Az állapot **Lezárva (lerakodva)** lesz.

### Törlés

1. Kattintson az **EKÁER törlés** gombra.
2. Írja be az **Indoklást**. Ez a NAV-hoz is elmegy.
3. Erősítse meg. Az állapot **Törölve** lesz, és ezután új bejelentés tehető.

## 5. Mérleg: sztornó

Hibás mérlegelés (pl. rossz rendszám) nem törölhető, csak sztornózható.

1. A sor végén kattintson a **Sztornó** gombra.
2. Írja be az **Indoklást**, pl. „rossz rendszám”.
3. Erősítse meg. Ennek a következményei:
   - a mérlegelés **Sztornó** állapotú lesz, a jegyszám megmarad;
   - a hozzá tartozó szállítás is sztornózódik, az SZ-szám megmarad;
   - külön, SZTORNÓ bélyegzős mérlegjegy- és szállítólevél-példány készül, az eredeti megmarad.
4. Ha élő EKÁER-bejelentés tartozik hozzá, azt a 4. pont szerint törölje.

## 6. Fuvarok és EKÁER: Szállítások

Bal menü: **Fuvarok és EKÁER**, majd a **Szállítások** fül.

Ide kerül minden nyilvántartott szállítás:

- a saját mérlegről (lezárt mérlegelés vevővel és termékkel);
- a papír jegyekből (8. pont).

1. **Mutatók**:
   - **Ma szállítva**;
   - **Ma nettó**;
   - **EKÁER-szám nélkül**: ezeket nézze meg, kell-e bejelenteni.
2. **Keresés**: SZ-szám, rendszám, vevő, termék vagy EKÁER-szám szerint.
3. A táblázat soronként ezt mutatja: SZ-szám, időpont, rendszám, vevő, termék, nettó, EKÁER-szám, állapot (**Nyilvántartva** vagy **Sztornó**).
4. A sor végén két hivatkozás van:
   - **Mérlegjegy**: a mérlegjegy PDF-je;
   - **Szállítólevél**: a szállítólevél PDF-je. A száma azonos az SZ-számmal. Egyszer készül el, utána nem változik.

Papír jegyből rögzített szállításnál az EKÁER-oszlopban a papír jegyen lévő EKÁER-szám látszik, ha volt rajta.

## 7. Fuvarok és EKÁER: Összesítő és Excel

A könyvelőnek szóló havi vagy időszakos kimutatás.

1. Nyissa meg az **Összesítő és Excel** fület.
2. Állítsa be az **Ettől** és **Eddig** dátumot. Mindkét nap beleszámít.
3. A képernyőn ezt látja:
   - **Szállítás** (darabszám), **Nettó összesen**, **Sztornó** (ezek nem számítanak bele az összegekbe);
   - **Vevők szerint** és **Termékek szerint** bontás.
4. Kattintson az **Excel letöltése** gombra. A fájl három lapból áll:
   - **Szállítások**: minden sor, a sztornózottak jelölve;
   - **Vevők szerint**;
   - **Termékek szerint**.

## 8. Fuvarok és EKÁER: Papír jegyek

Az átmeneti időszak papír mérlegjegyei (PORTAL AI) és kézzel írt szállítólevelei. Ezeket kell rögzíteni, és ha kell, bejelenteni az EKÁER-t.

### Feltöltés

1. Nyissa meg a **Papír jegyek** fület.
2. Húzza a fotót a szaggatott keretbe, vagy kattintson bele, és válassza ki a fájlt.
   - Formátum: JPG, PNG vagy PDF, legfeljebb 10 MB. Egyszerre több fájl is mehet.
   - Egy fotón lehet a mérlegjegy és a szállítólevél is, egymás mellett.
3. Ugyanazt a fájlt csak egyszer lehet feltölteni. Ha másodszor próbálja, ezt az üzenetet kapja: „Ez a fájl már fel van töltve.”

### Kiolvasás

Feltöltés után a fotót az AI olvassa ki, fotónként kb. 20–60 másodperc alatt. Az oldal magától frissül, nem kell újratölteni. Az állapotok:

- **Feldolgozás…**: az AI még dolgozik a fotón.
- **Ellenőrzésre vár**: a kiolvasás kész. A listában már látszik a jegyszám, a rendszám, a vevő, az anyag, a nettó, az EKÁER-szám és a szállítólevél-szám.
- **Nem olvasható, kézzel töltendő**: az AI nem tudta kiolvasni a képet.
- **Rögzítve · SZ-2026-…**: a jegyből már szállítás lett.

A **sárga, „?”-lel jelölt** értékekben az AI bizonytalan (80% alatti megbízhatóság). Ezeket mindenképp vesse össze a fotóval.

### Ellenőrzés és mentés

1. Az „Ellenőrzésre vár” sorban kattintson az **Ellenőrzés** gombra.
2. Bal oldalt a fotó látszik:
   - a **Forgatás** gomb 90°-kal elforgatja (a fotók gyakran oldalra állnak);
   - a **Nagyítás** gomb eredeti méretben mutatja, ilyenkor görgetni lehet.
3. Jobb oldalt az űrlap az AI által kiolvasott adatokkal. A sárga címkéjű mezőket vesse össze a fotóval, és javítsa, ha kell.
   - **Mérlegjegy száma**, pl. `MJ-2026-003277`.
   - **Mérés ideje**.
   - **Rendszám** és **Pótkocsi**. Kötőjelet és szóközt nem kell írni, a rendszer kiveszi.
   - **Vevő** és **Termék**: a listából kell választani. A rendszer megpróbálja párosítani a jegyen lévő névvel; a címke mutatja, mi állt a jegyen. Ha a vevő vagy a termék nincs a listában, előbb vegye fel a 2. pont szerint.
   - **Bruttó** és **Tára (kg)**. A **Nettó** magától számolódik.
   - **Szállítólevél száma**, pl. `Cs 0096867`.
   - **Felrakodási cím**, pl. `8000 Székesfehérvár, 020195/3 hrsz.`
   - **Lerakodási cím**, pl. `2063 Óbarok, 47.495861, 18.561926`. Ha üresen hagyja, a vevő címe lesz a lerakodási hely.
     - A fenti két cím „irányítószám település, …” formában kell, különben az EKÁER nem fogadja el.
   - **EKÁER-szám a jegyen**: ha a papír jegyen van EKÁER-szám, itt marad, és **nem jelentjük be újra**.
   - **EKÁER-érték (Ft)**: a termék árából és a nettóból magától kitöltődik, de átírható.
   - **EKÁER bejelentése mentéskor**: csak akkor számít, ha a jegyen nincs EKÁER-szám.
4. Kattintson a **Mentés** gombra. A rendszer ezt csinálja:
   - papír mérlegelést hoz létre `P-MJ-2026-003277` számmal (a P- jelzi, hogy papír jegyből jött, így nem keveredik a saját mérlegjegy-számokkal);
   - nyilvántartásba veszi a szállítást (SZ-2026-…), ami megjelenik a **Szállítások** fülön;
   - ha a jegyen nem volt EKÁER-szám és be van pipálva a bejelentés, elindítja az EKÁER-t.
5. Az értesítés mutatja az eredményt, pl. `SZ-2026-000045 rögzítve, EKÁER-bejelentés elindult`.

**Ha az EKÁER nem indult el** (pl. hiányzik a vevő adószáma): a szállítás ettől még rögzül, az értesítés kiírja az okot. Pótolja a hiányzó adatot, majd jelentse be kézzel a **Mérleg** oldalon (4. pont). A papír mérlegelés ott P- előtaggal szerepel.

**Ugyanaz a papír jegyszám kétszer nem menthető.** Ha mégis próbálja, ezt az üzenetet kapja: „Ez a papír jegy már rögzítve van.”

## 9. Fuvarok és EKÁER: Szabályok (automatikus EKÁER)

1. Nyissa meg a **Szabályok** fület.
2. Az **Automatikus EKÁER-bejelentés** kapcsolóval állíthatja: **Bekapcsolás** vagy **Kikapcsolás**.
3. Bekapcsolva a rendszer a **második mérésnél** magától bejelenti az EKÁER-t a mért nettóval, még indulás előtt. Ehhez minden adatnak meg kell lennie:
   - a termék EKÁER-köteles, van 8 jegyű VTSZ-e és ára (Ft/t);
   - a vevőnek van adószáma és „irányítószám település, utca” formájú címe.
4. Ha bármi hiányzik, a bejelentés nem indul el magától. Ilyenkor a Mérleg oldalon kézzel kell bejelenteni.
5. Az érték: nettó tonna × ár. Minden átállítás bekerül a naplóba, a végrehajtó nevével.

Ez a kapcsoló csak a saját mérlegre vonatkozik. Papír jegynél a mentéskor dönt arról, hogy legyen-e bejelentés (8. pont).

## 10. Gyakori helyzetek

| Helyzet                                                             | Teendő                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nem lehet megnyomni az **Első mérés** vagy **Második mérés** gombot | Az élő súly nem **Stabil**. Várjon, amíg a jármű megáll.                                                                                                      |
| „Nincs jel” az élő súlynál                                          | A mérlegprogram vagy a kapcsolat nem működik. Szóljon a rendszergazdának.                                                                                     |
| Lezárt mérlegelésnek nincs SZ-száma                                 | Hiányzott a vevő vagy a termék. Kattintson a **Nyilvántartásba vétel** gombra. Ha hibát ír, sztornózza a mérlegelést, és mérjen újra a helyes adatokkal.      |
| EKÁER: „A vevő adószáma hiányzik vagy hibás”                        | Javítsa a vevőt a Mérleg › Vevők fülön, majd jelentse be újra.                                                                                                |
| EKÁER: „A termék VTSZ-száma 8 számjegy legyen”                      | Javítsa a terméket a Mérleg › Termékek fülön.                                                                                                                 |
| Papír jegy hosszan „Feldolgozás…” állapotban marad                  | Szóljon a rendszergazdának: a feldolgozó (worker) vagy az AI-kapcsolat nem fut.                                                                               |
| Rossz adattal mentett papír jegy                                    | Sztornózza a P- kezdetű mérlegelést a Mérleg oldalon (5. pont). A fotót viszont nem lehet újra feltölteni (ugyanaz a fájl), ezért szóljon a rendszergazdának. |
