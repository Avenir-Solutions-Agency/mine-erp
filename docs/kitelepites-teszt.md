# Online tesztkörnyezet: mi kell a kitelepítéshez

Készült: 2026-10-30. Címzett: a Mészkő-Polgár ERP 2.0 megrendelője.

## Röviden

Az ERP most csak a fejlesztő gépén fut. Hogy bárki böngészőből kipróbálhassa, kell egy **online tesztkörnyezet**: egy bérelt szerver az EU-ban, amire minden jóváhagyott fejlesztés után magától felkerül az új verzió.

- **Költség:** kb. 5–7 € + ÁFA havonta (1 szerver a Hetznernél, mentéssel). A mostani Supabase-, OpenAI- és GitHub-előfizetés mellett nincs más díj.
- **Átfutás:** a szerver létrehozása után kb. 1 munkanap fejlesztés.
- **Tőletek kell:** egy Hetzner-fiók és benne egy szerver (fizetési adatokkal), opcionálisan egy aldomain, és kb. 30 perc a titkos kulcsok beállítására.

A tesztkörnyezet **nem éles**: a NAV felé szimulált EKÁER megy, valódi bejelentés nem történik.

## Mit kapunk

| | |
|---|---|
| Cím | elsőre `https://teszt.<szerver-IP>.sslip.io` (nem kell hozzá domain), később pl. `https://teszt.meszkopolgar.hu` |
| Belépés | ugyanúgy, mint most: e-mail, jelszó és kétlépcsős kód (2FA) |
| Frissítés | minden jóváhagyott (mergelt) fejlesztés után magától, kb. 5 percen belül |
| Mi működik | Mérleg (szimulált mérleggel), Fuvarok és EKÁER, Papír jegyek AI-kiolvasással, Számlák, Excel |
| EKÁER | szimulált NAV; a valódi NAV-hoz nem kapcsolódik |
| Mérleg | a mérlegszimulátor bármelyik gépről küldhet súlyt az online rendszernek |

## Mire van szükség tőletek

### 1. Hetzner-fiók és szerver (kötelező)

A Hetzner német szolgáltató, a szerver az EU-ban van. Az architektúra ezzel számol, és a személyes adatok miatt is az EU-s tárolás kell.

1. Regisztráció: https://console.hetzner.com. A cég adataival és fizetési móddal (bankkártya vagy SEPA) a cég nevére.
2. Új projekt: „Meszko-Polgar ERP”.
3. Új szerver:
   - **Típus:** CX23 (2 vCPU, 4 GB RAM, 40 GB SSD; a régebbi CX22 utódja), kb. 4–5 € + ÁFA havonta. A pontos árat a Hetzner oldalán nézzük meg, mert 2026-ban többször változott.
   - **Hely:** Falkenstein vagy Nürnberg (Németország).
   - **Rendszer:** Ubuntu 24.04.
   - **SSH-kulcs:** a fejlesztő küldi meg a nyilvános kulcsát (ez nem titkos), azt kell hozzáadni.
   - **Mentés (Backups):** bekapcsolva, a szerverdíj +20%-a (kb. 1 €).
4. A fejlesztőnek elküldendő: a szerver **IP-címe**. Jelszót nem kell küldeni.
5. Ajánlott: hozzáférés a fejlesztőnek a Hetzner-projekthez „Member” szerepkörrel. A fiók és a számlázás a cégnél marad.

### 2. Aldomain (ajánlott, de nem kötelező)

Ha van a cégnek domainje (pl. `meszkopolgar.hu`), annak kezelőjénél egy DNS-bejegyzés kell:

- **Típus:** A
- **Név:** `teszt`
- **Érték:** a szerver IP-címe

Domain nélkül is működik a `sslip.io` címmel, csak az kevésbé szép.

### 3. Titkos kulcsok (kötelező, a fejlesztővel együtt)

A kulcsok a GitHubon, a projekt titkos beállításai közé kerülnek (Settings › Secrets). Onnan csak a kitelepítés olvassa őket, a kódba és a chatbe nem kerülnek. Ezek a kulcsok már megvannak, csak be kell őket másolni:

- Supabase: projektcím, nyilvános kulcs, titkos kulcs, adatbázis-kapcsolat
- OpenAI API-kulcs (a számlák és a papír jegyek kiolvasásához)
- a mérlegszimulátor tokenje
- a szerver SSH-kulcsa a kitelepítéshez

Ezt a fejlesztő vezeti végig, kb. 30 perc.

### 4. Döntések

| Kérdés | Javaslat |
|---|---|
| Legyen-e külön adatbázis a tesztkörnyezetnek? | Most nem kell, a meglévő Supabase-t használja. Élesítés előtt viszont külön éles adatbázis kell. |
| Kik kapjanak hozzáférést? | Akinek fiókot hoz létre a rendszergazda. Nyilvános regisztráció nincs. |
| A Vercel maradjon? | Nem kell. A webfelület is a Hetzner-szerverre kerül, mert a többi rész is ott fut. |

## Mit csinál a fejlesztő

1. Csomagolja a rendszer részeit (webfelület, API, háttérfolyamatok, PDF-készítő) Docker-konténerekbe.
2. Beállítja a szervert: tűzfal, HTTPS-tanúsítvány, automatikus újraindítás.
3. Beállítja az automatikus kitelepítést a GitHubon: jóváhagyott fejlesztés után ellenőrzés, építés, kitelepítés, adatbázis-frissítés.
4. Kitelepítés után ellenőrzi a működést (állapotellenőrzés, belépés, mérlegelés szimulátorral).
5. Kiegészíti a felhasználói útmutatót az online használattal.

## Kockázatok és korlátok

- **Közös adatok:** a tesztkörnyezet és a fejlesztő gépe ugyanazt az adatbázist használja, ezért az adatok keverednek. Tesztre ez elfogadható.
- **Egy szerver:** ha leáll, a tesztkörnyezet sem érhető el. Tesztre elég, élesre külön tervezünk.
- **Nem éles EKÁER:** a NAV tesztrendszeréhez külön tesztfelhasználó kell. Ez külön kérés, még nyitott.
- **Valódi mérleg:** online is csak a szimulátor működik, amíg a mérlegfej adatai nincsenek meg (lásd a `docs/ugyfel-keresek.md` 3. pontját).

## Összefoglalva: a teendők

1. Hetzner-fiók és CX23-szerver létrehozása, a fejlesztő SSH-kulcsával. Utána az IP-cím elküldése.
2. Opcionális: DNS-bejegyzés a `teszt` aldomainhez.
3. 30 perc a fejlesztővel a titkos kulcsok beállítására.
4. Ezután kb. 1 munkanap, és az online tesztkörnyezet elérhető.
