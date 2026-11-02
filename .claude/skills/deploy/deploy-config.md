# Deploy configuration

Read by the deploy skill. Values only, never secrets. Any value still in [brackets]: the skill stops and asks.

| Key                       | Value                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Platform                  | Docker on Hetzner (EU), described with Terraform                                                             |
| Orchestration             | [Docker Compose or k3s, decided in an ADR]                                                                   |
| Deploy method             | `main` → test environment automatically (GitHub Actions); tagged release → production with manual approval   |
| Production branch         | main (releases are tags)                                                                                     |
| Test URL                  | https://erp.94-16-109-232.sslip.io (shared netcup server, Docker Compose; see docs/kitelepites-teszt.md)     |
| Production URL            | [https://erp.example.hu]                                                                                     |
| Smoke checks              | `curl -sSf <url>/api/health` (web); the API is not public except `POST /scale/readings`                      |
| Required env vars (names) | see docs/ARCHITECTURE.md §09, stored in the secret store, never here                                         |
| EKÁER endpoint            | test: `import-test.ekaer.nav.gov.hu`; production: `import.ekaer.nav.gov.hu` (production environment only)    |
| Rollback                  | [redeploy the previous image tag; migrations are expand–contract, so the old version runs on the new schema] |
| Who deploys production    | only the user; Claude prepares and verifies                                                                  |
