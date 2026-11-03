# Online tesztkörnyezet

Frissítve: 2026-11-02. Döntés: a teszt a meglévő netcup szerveren fut, a már ott futó „alfred-black” rendszer mellett.

## Röviden

- **Cím:** https://erp.94-16-109-232.sslip.io (domain nélkül, a `sslip.io` az IP-címből ad nevet; HTTPS-tanúsítvány magától)
- **Szerver:** netcup VPS, EU, Debian 13, 12 mag, 31 GB RAM. Az ERP kb. 3 GB-ot használ.
- **Frissítés:** minden mergelt fejlesztés után magától. A GitHub lefuttatja az ellenőrzéseket (CI), és ha zöld, kitelepít.
- **Plusz költség:** nincs. A szerver már elő van fizetve, a Supabase és az OpenAI a meglévő.
- **EKÁER:** szimulált NAV, valódi bejelentés nem megy ki.

## Hogyan épül fel

| Rész | Hol fut |
|---|---|
| Webfelület, API, háttérfolyamat (worker), adatbázis-frissítés | a mi Docker-konténereinkben (`infra/docker-compose.test.yml`, projektnév `mine-erp-test`) |
| Temporal, Gotenberg (PDF) | szintén a mi konténereinkben, kívülről nem érhetők el |
| HTTPS | a szerver meglévő Caddyje (az alfred-black rendszeré); ebbe kerül egy új bejegyzés |
| Adatbázis, belépés, fájlok | a meglévő Supabase-projekt (ugyanaz, mint fejlesztéskor) |

Kívülről csak a webfelület és a mérleg-ügynök két végpontja (`/scale/readings` és `/scale/portal-weighings`, tokennel védve) érhető el. Az API többi része csak a webfelületen keresztül.

A kitelepítés útja: GitHub Actions → `git archive` SSH-n a szerverre → `infra/deploy-test.sh` → `docker compose up --build`. A GitHub kulcsa a szerveren csak ezt az egy scriptet futtathatja, shellt nem nyithat.

## Egyszeri beállítás

Ezt egyszer kell elvégezni, kb. 45 perc. Jelszót, kulcsot ne másolj be a chatbe.

### 1. Engedély (a főnök)

A Caddy az alfred-black rendszerhez tartozik. A módosításhoz a gazdája engedélye kell, mert ha a beállítás hibás, az ő oldalai is leállhatnak.

### 2. Szerver: felhasználó és mappák (rootként)

```
adduser --disabled-password --gecos "" mineerp
usermod -aG docker mineerp
mkdir -p /opt/mine-erp /etc/mine-erp
chown mineerp:mineerp /opt/mine-erp
```

A Macről másold fel a kitelepítő scriptet (a repó gyökeréből):

```
scp infra/deploy-test.sh root@94.16.109.232:/usr/local/bin/mine-erp-deploy-test
ssh root@94.16.109.232 chmod 755 /usr/local/bin/mine-erp-deploy-test
```

### 3. Szerver: titkos beállítások

```
nano /etc/mine-erp/test.env
chown root:mineerp /etc/mine-erp/test.env
chmod 640 /etc/mine-erp/test.env
```

A fájlba ugyanazok a nevek kellenek, mint a `.env.example`-ben, az értékek a jelszókezelőből. Ami eltér a fejlesztői beállítástól:

| Név | Érték |
|---|---|
| `WEB_ORIGIN` | `https://erp.94-16-109-232.sslip.io` |
| `AUTH_REQUIRE_AAL2` | `true` |
| `ALLOW_DATA_RESET` | `false` |
| `EKAER_SIMULATE` | `true` |
| `SCALE_AGENT_TOKEN` | új érték: `openssl rand -hex 32` |

Kötelező még: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`. A `TEMPORAL_ADDRESS`, a `GOTENBERG_URL` és az `API_BASE_URL` értékét a Compose-fájl adja, ezeket ne írd bele.

### 4. Kitelepítő kulcs

A Macen:

```
ssh-keygen -t ed25519 -f ~/.ssh/mine-erp-deploy -N "" -C github-deploy-test
ssh-keyscan -t ed25519 94.16.109.232
```

A szerveren rootként (a `<publikus kulcs>` helyére a `~/.ssh/mine-erp-deploy.pub` tartalma kerül):

```
mkdir -p /home/mineerp/.ssh
echo 'command="/usr/local/bin/mine-erp-deploy-test",restrict <publikus kulcs>' >> /home/mineerp/.ssh/authorized_keys
chown -R mineerp:mineerp /home/mineerp/.ssh
chmod 700 /home/mineerp/.ssh
chmod 600 /home/mineerp/.ssh/authorized_keys
```

### 5. GitHub

Settings › Environments › új környezet: `test`.

| Típus | Név | Érték |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | a `~/.ssh/mine-erp-deploy` (privát kulcs) teljes tartalma |
| Secret | `DEPLOY_KNOWN_HOSTS` | az `ssh-keyscan` kimenete |
| Variable | `DEPLOY_USER` | `mineerp` (a szerveren már volt egy `deploy` felhasználó, azt nem használjuk) |
| Variable | `DEPLOY_HOST` | `94.16.109.232` |
| Variable | `TEST_URL` | `https://erp.94-16-109-232.sslip.io` |

A privát kulcsot a GitHubra feltöltés után törölheted a Macről.

### 6. Caddy (az 1. pont engedélyével)

A `/opt/nova/caddy/Caddyfile` végére:

```
erp.94-16-109-232.sslip.io {
	# The scale agents' two token-protected endpoints: live weight and PORTAL AI weighings.
	@agent path /scale/readings /scale/portal-weighings
	handle @agent {
		reverse_proxy mine-erp-api:4000
	}
	handle {
		reverse_proxy mine-erp-web:3000
	}
}
```

Előbb mentés és ellenőrzés, csak utána újratöltés:

```
cp /opt/nova/caddy/Caddyfile /opt/nova/caddy/Caddyfile.bak
docker exec alfred-black-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec alfred-black-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Ha a `validate` hibát ír, ne töltsd újra: állítsd vissza a `.bak` fájlt.

### 7. Első kitelepítés

A merge után a `main` CI-ja zöld lesz, és a „Deploy test” workflow magától elindul. Kézzel: GitHub › Actions › Deploy test › Run workflow. Az első építés kb. 5–10 perc.

Ellenőrzés: `https://erp.94-16-109-232.sslip.io/api/health` → `{"status":"ok"}`, majd belépés a meglévő fiókkal.

## Mérlegszimulátor az online rendszerrel

Bármelyik gépről, ahol a repó megvan:

```
API_BASE_URL=https://erp.94-16-109-232.sslip.io SCALE_AGENT_TOKEN=<a test.env-beli érték> pnpm --filter @mine-erp/scale-agent simulate
```

## Hibakeresés a szerveren

```
cd /opt/mine-erp/app
docker compose -f infra/docker-compose.test.yml ps
docker compose -f infra/docker-compose.test.yml logs --tail 100 mine-erp-api mine-erp-worker mine-erp-web
```

## Kockázatok és korlátok

- **Közös szerver:** aki rootként hozzáfér, az mindkét rendszer adataihoz hozzáfér, és ha az egyiket feltörik, a másik is veszélyben van. Tesztre elfogadható. Élesre külön szerver kell.
- **Közös adatbázis:** a teszt és a fejlesztő gépe ugyanazt a Supabase-t használja, az adatok keverednek. Élesítés előtt külön éles adatbázis kell.
- **Root jelszó:** a szerver root jelszava egy chatbe is bekerült. Ajánlott lecserélni (`passwd`), és a jelszavas SSH-belépést kikapcsolni.
- **Nem éles EKÁER:** a NAV tesztrendszeréhez külön tesztfelhasználó kell, ez még nyitott.
- **Valódi mérleg:** online is csak a szimulátor működik, amíg a mérlegfej adatai nincsenek meg (`docs/ugyfel-keresek.md` 3. pont).
- **Mentés:** a Temporal-adatok egy Docker-kötetben vannak a szerveren, mentés nélkül. Tesztre elég; az üzleti adatok a Supabase-ben vannak.
