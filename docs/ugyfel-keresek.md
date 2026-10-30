# Kérések az ügyfél felé

Amit a fejlesztéshez az ügyféltől (Mészkő-Polgár Kft.) vagy a beszállítóitól kérünk. Ha egy tétel teljesül, kerüljön mellé a dátum és az, hogy ki intézte.

## 1. PORTAL AI mérlegprogram: olvasási hozzáférés az ERP API-hoz

**Állapot:** kérve, 2026-10-30. Válaszra vár.

**Miért kell:** az átmeneti időszakban, amíg az ERP saját mérlegelése nem élesedik, a mérlegjegyek a PORTAL AI-ból (Nettó Mérlegtechnika Kft.) jönnek. Most ezeket fotóról, AI-val olvassuk ki, és kézzel ellenőrizzük. Az API-ból ugyanezt pontosan, kézi munka nélkül kapnánk meg:

- jegyszám, rendszámok, bruttó/tára/nettó;
- vevő adószámmal és címmel, anyag VTSZ-szel;
- felrakodási raktár és lerakodási hely;
- a PORTAL AI által már beadott **EKÁER-szám és EKÁER-állapot**.

Az utóbbi miatt különösen fontos: így látszik, melyik szállítást jelentette már be a PORTAL AI, és nem jelentjük be még egyszer.

Csak **olvasni** fogunk. Az ERP nem ír a PORTAL AI-ba, és nem küld tömeget.

**Mit kérünk:**

1. A PORTAL AI-ban kapcsolják be az **ERP API-t, csak olvasási módban** (Program › ERP API kapcsolat), az írási parancsokat hagyják kikapcsolva.
2. Hozzanak létre egy **API-kulcsot** (`portal_erp_…`), és jelszókezelőn keresztül adják át. E-mailben vagy chatben ne küldjék.
3. Írják meg a **programverziót**. Az API-hoz 2026 fix2149 vagy újabb kell; ha régebbi fut, frissítést kérünk.
4. Nevezzék meg, ki intézi a **hálózati elérést** a mérleg-PC-hez (bányai rendszergazda vagy a Nettó Mérlegtechnika). Az API a mérleg-PC 8000-es portján fut, a helyi hálózaton. A felhőben futó ERP csak így érheti el:
   - VPN-en keresztül, vagy
   - egy, a bányában futó kis továbbító programmal, a gyártó ajánlása szerint külön VLAN-on és tűzfal mögött.
5. Adjanak egy kapcsolattartót a Nettó Mérlegtechnikától technikai kérdésekre.

**Ha nem kapjuk meg:** marad a fotós feltöltés (Fuvarok és EKÁER › Papír jegyek), ami már működik, csak több vele a kézi munka.

## 2. A hídmérleg hitelesítése

**Állapot:** kérve, 2026-10-30. Válaszra vár.

**Miért kell:** a PORTAL AI mérlegjegyek alján ez áll: „Mérleg típusa: NH-VW | Hitelesítés érvényessége: 2026.09.23.” Ez a dátum lejárt, a jegyeken pedig 2026.10.26-i mérések vannak. Lejárt hitelesítésű mérleg mérése kereskedelmi célra (számla, szállítólevél, EKÁER) nem használható.

**Mit kérünk:**

1. Megújították-e a hitelesítést 2026.09.23 után? Ha igen, a **hitelesítési bizonyítvány** másolatát kérjük, és az új lejárati dátumot.
2. Ha a nyomtatott dátum csak elavult, javíttassák a PORTAL AI beállításában.
3. Ha nem újították meg, akkor sürgősen intézzék, és jelezzék, mely napok mérései érintettek.

## 3. A mérlegfej (kijelző) adatai a saját mérlegeléshez

**Állapot:** kérve, 2026-10-30. Válaszra vár. **Blokkoló:** enélkül az ERP saját mérlegelése nem élesíthető.

**Miért kell:** az ERP a PORTAL AI helyett maga rögzíti a mérlegeléseket. A súlyt ugyanattól a mérlegfejtől kapja, ami most a PORTAL AI-nak küldi. Ma az ERP csak szimulált súllyal működik. A valódi kapcsolathoz tudnunk kell, milyen eszközről, milyen csatlakozáson és milyen adatformátumban jön a súly. A mérlegfejhez nem nyúlunk, és nem állítjuk át.

**Mit kérünk:**

1. A mérlegfej **gyártója és típusa**. Egy fotó a mérlegfej adattáblájáról is elég.
2. A **csatlakozás** a mérlegház-PC felé: RS-232, RS-485, USB vagy Ethernet. Ha van, a soros port beállításai (sebesség, adatbitek, paritás).
3. Az **adatformátum (protokoll)**, ha ismert. Ha nem ismert, a mérlegfej kézikönyve, vagy a Nettó Mérlegtechnika leírása arról, hogyan olvassa a PORTAL AI.
4. Pontosan hol van a mérlegház-PC, és van-e rajta **hálózat (internet)**, hogy oda telepíthessük a kis olvasóprogramot.
5. Van-e **rendszámfelismerő kamera** és **jegynyomtató**, és ha igen, milyen típus.
6. Ki a kapcsolattartó, aki a helyszínen segít az átállásnál (bányai kolléga vagy a Nettó Mérlegtechnika).

**Fontos:** a mérlegfej bekötése és az, hogy az ERP hitelesített mérlegjegyet állíthat-e ki, a mérésügyi szabályokat is érinti (lásd a 2. pontot). Az átállás előtt ezt a Nettó Mérlegtechnikával vagy a hitelesítő szervvel egyeztetni kell.
