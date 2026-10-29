# Architecture: Mészkő-Polgár ERP 2.0

The map of how the app is built and how its parts connect. Details and rationale: the spec (`docs/Mészkő-Polgár ERP 2.0 – fejlesztői specifikáció.md`) §2–§13. When the structure changes, update this file in the same commit. Larger decisions get a short ADR in `docs/adr/`.

Current state: only `apps/web` (Next.js scaffold) exists. Everything marked **Target (not yet true)** is the agreed design that does not exist in code yet.

## 01 System overview

A modular monolith in one TypeScript monorepo: one API, one workflow worker, one web UI, one Telegram bot, one local scale agent, sharing one PostgreSQL database.

```
Scale software --> scale-agent --HTTPS--+
Telegram ------> bot (grammY) ---------+--> api (NestJS, REST + OpenAPI + MCP) --> PostgreSQL
Browser -------> web (Next.js) --------+          |                                  ^
AI agents -----> MCP (inside api) -----+          v                                  |
                                          Temporal <--> worker (workflows, activities)
                                                          |
                                                          +--> NAV EKÁER, OpenAI API, Telegram Bot API,
                                                               Billingo, S3 object store, Gotenberg
```

- Inputs reach the system only through the API (Telegram through the bot, which calls the API).
- Only the Temporal worker calls external systems, so every call is retryable and logged.
- Every feature is API first, screen second. AI agents call the same API through the MCP server.
- The web app never talks to the database directly.

## 02 Tech stack

| Layer | Choice | Why this, not the obvious alternative |
| --- | --- | --- |
| Language | TypeScript strict, Node.js 22 LTS | One language everywhere; shared Zod schemas |
| Monorepo | pnpm workspaces + Turborepo | Shared `domain`, `db`, `contracts` packages across five apps |
| Web | Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (base-nova), TanStack Query and Table | Server components for office screens; same code later as PWA |
| Backend | NestJS, REST + OpenAPI 3.1 | Several clients (web, bot, scale agent, AI agents) need one typed API; Next route handlers would mix UI and domain |
| Workflows | Temporal (TypeScript SDK) | EKÁER lifecycle, document pipeline, retries and signals need durable state, not a cron |
| Database | PostgreSQL 17 on Supabase (hosted, EU region) | Strongly relational data, event log, row-level security, PITR; managed instead of self-run (decided 2026-10-28) |
| Queries | Drizzle ORM + drizzle-kit migrations | SQL-close, typed, no heavy runtime |
| Validation | Zod (`packages/contracts`) | Same schemas on API, web and worker |
| Auth | Supabase Auth, TOTP 2FA (MFA); PIN or QR card on mobile | Same project as the database, no separate identity server to run (decided 2026-10-28, replaces Keycloak) |
| Files | Supabase Storage through its S3-compatible endpoint, SHA-256 on every file | Evidence for EKÁER and documents; S3 API keeps the client portable (decided 2026-10-28, replaces MinIO) |
| AI | OpenAI Responses API (PDF and image input, structured outputs; decided 2026-10-29), own MCP server | Structured extraction; model id in config (`OPENAI_MODEL`), never in code |
| Telegram | grammY, webhook mode | TypeScript-native, stateless |
| PDF | HTML template → Gotenberg | Delivery note, quote, TIG |
| Payments / Email | none in v1 | Out of scope |
| Hosting | Docker on Hetzner (EU), Terraform; Compose or k3s per ADR | EU data residency; not Vercel (several long-running services) |
| CI | GitHub Actions | Lint, typecheck, tests, migration check, image build per PR |
| Observability | OpenTelemetry, Grafana, Loki, Sentry | Pipeline, EKÁER and AI cost dashboards |
| Testing | Vitest (+ Testcontainers, Temporal test env), Playwright | Pure domain rules ≥ 90% unit coverage; e2e for the photo → EKÁER flow |
| Secrets | Vaultwarden or OpenBao | Never in code or the repo |

Do not add a dependency that overlaps with a row in this table without asking.

## 03 Project structure

```
/
  AGENTS.md              agent instructions (read first)
  docs/                  PRD, design system, this file, SECURITY, TASKS, adr/
  apps/
    web/                 Next.js UI (+ PWA later). Exists.
      src/app/           routes and pages only, no business logic
      src/components/ui/ primitives (see DESIGN_SYSTEM.md)
      src/lib/           web-only helpers, env.ts (server-only)
    api/                 NestJS REST API + MCP server            Exists: invoices (T-034b)
    worker/              Temporal workflows and activities       Exists: skeleton (T-009)
    bot/                 Telegram bot (grammY, webhook)          Target (not yet true)
    scale-agent/         local scale agent, single binary        Exists: simulator only (T-035)
  packages/
    domain/              entities, state machines, rules; pure TS, no I/O   Target
    db/                  Drizzle schema, migrations, seed                    Exists (T-034a)
    contracts/           Zod schemas, OpenAPI generation, client             Target
    ekaer/               EKÁER XML client (signing, XSD validation)          Exists (T-013)
    extraction/          AI extraction (prompt, schema, evaluation set)      Target
    ui/                  shared shadcn components (once a second app needs them) Target
  infra/                 Terraform, docker-compose, Grafana dashboards       Target
```

Where new code belongs:
- A business rule or state transition: `packages/domain`, as a pure function with unit tests.
- A table or migration: `packages/db`.
- A request/response shape: `packages/contracts` (Zod), used by api, web and worker.
- An endpoint: `apps/api/src/<module>/` (thin controller → service → repository).
- An external call: a Temporal activity in `apps/worker`, using a client package (`packages/ekaer`, …).
- A page: `apps/web/src/app/<route>/page.tsx`, thin, calls the API.
- A UI primitive: `apps/web/src/components/ui/`, added to DESIGN_SYSTEM.md §06 in the same commit.

## 04 Data flow

Document pipeline (`ProcessDocumentWorkflow(documentId)`, idempotent, restartable at any step, every step writes an event): `ingest → extract → normalize → validate → link → register → ekaer → notify`. Failing items go to `needs_review`; after a human fix the workflow resumes from `validate` (Temporal signal).

Request path for every write:
1. User action in web, bot or scale agent.
2. API controller validates the input with a Zod schema from `packages/contracts`.
3. Service applies the rule from `packages/domain`.
4. Repository writes through Drizzle and appends to `event_log` in the same transaction.
5. Typed response returns; long work is started as a workflow, not done in the request.

State:
- Server state lives in PostgreSQL. Stock and revenue are computed from movements and closed shipments, never stored as totals.
- Client state is UI only (TanStack Query cache, open panels, form drafts).
- Optimistic updates: none in v1.

Auth:
- Supabase Auth; the API verifies the Supabase JWT against the project's JWKS. Authorization is decided in the API layer, not the UI. Services receive the actor (user or agent service account).

Errors:
- Validation errors return a code and a Hungarian message.
- Unexpected errors are logged with a request id and shown as a generic message. Never stack traces, vendor text or secrets.

## 05 Boundaries

Dependencies flow one way: `apps/* → packages/contracts → packages/domain`; `apps/api`, `apps/worker → packages/db`.

Allowed:
- web imports `contracts` and `ui`; it calls the API over HTTP.
- api and worker import `domain`, `db`, `contracts` and client packages.
- bot and scale-agent call the API only.

Never:
- `packages/domain` does I/O or imports `db`, an app, or a vendor SDK.
- web, bot or scale-agent import `db` or a vendor client.
- api calls an external system directly instead of starting a workflow or activity.
- Anything in the client bundle reads a secret. Server-only modules import `server-only`.

## 06 Decisions that look wrong but are intentional

The agent must not "fix" these.

- Money is an integer in fillér (`bigint`), weight an integer in kg, time stored in UTC and shown in Europe/Budapest. No floats.
- Ids are UUIDv7; business numbers (SZ-2026-000123) come from a separate gapless database sequence.
- `event_log` is append-only, enforced by database grants. Never update or delete its rows.
- Before resending an EKÁER create after a timeout or network error, always `queryTradeCards` by `orderNumber`. A blind retry can create a duplicate report.
- EKÁER modify, delete and correction always need human approval with a reason, even when the agent could do it.
- Fuzzy master-data matches are suggestions only; they never auto-link.
- The full EKÁER request and response XML is stored in the object store as evidence (without password or signing key).
- EKÁER thresholds and the AI model id live in configuration, not code, because law and models change.
- The bot and the scale agent contain no business logic; they only create a `document` and start the workflow.
- The prototype (`apps/web/src/prototype/`, PRD §05a) imports `packages/domain` directly and keeps seeded state in the browser, with no API. This is the one allowed exception to §05 for web, and only inside that folder. Pages outside it follow §05.
- The prototype and the demo functions it uses in `packages/domain` (`demo/` folder) compute money and weight with JavaScript numbers (Ft, tonnes), exactly like the demo, so every figure matches it. The integer fillér/kg rule applies to the real backend.
- All prototype screens go through one route, `apps/web/src/app/(prototype)/[route]/page.tsx`, which renders `src/prototype/screens/<route>.tsx` in the browser. The engine is client-only (random seed, reset on reload), so the server renders no screen content.
- Prototype screens keep the demo's Hungarian copy inline, as in the demo source, so the port stays diffable against it. i18n keys (AGENTS.md §03) apply to the shell and to production screens.

## 07 Scalability and future considerations

- Expected scale for v1: one quarry, about 20 own trucks plus outside carriers, hundreds of shipments per day at most, a few dozen users (assumed — confirm). Build for this, not for 100x.
- Known limits: single region (Hetzner EU), single tenant.
- Planned next: phase 2 (quotes, orders, contracts, Billingo invoicing), then operations and automation. The data model already allows generating `stock_movement` from shipments.
- Not planned: multi-tenant, native mobile apps. Do not add abstractions for these.

## 08 When the agent must stop and ask

If a task needs any of the following, stop, name the conflict, and propose the smallest change that avoids it:
- Crossing a boundary in section 05
- Changing a decision in section 06
- Adding a table, a migration that is not expand–contract, a dependency, or a third-party service
- Changing the auth, EKÁER submission or policy-engine flow

## 09 Environments and configuration

| Environment | URL | Deployed from | Data |
| --- | --- | --- | --- |
| Local | http://localhost:3000 (web) | your machine, `docker compose -f infra/docker-compose.yml up -d` + `pnpm dev` | hosted Supabase dev project (EU); local Temporal dev server (UI :8233) and Gotenberg (:3001) |
| Test | not set yet | `main`, automatically | test database; EKÁER test environment |
| Production | not set yet | tagged release, manual approval | production database |

Environment variables (names only; values live in the secret store and `.env.local`):

| Name | Used by | Server-only |
| --- | --- | --- |
| DATABASE_URL | api, worker | yes |
| TEMPORAL_ADDRESS | api, worker | yes |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | web | no (public by design; access is enforced by RLS and the API) |
| SUPABASE_URL | api, worker | yes |
| SUPABASE_SECRET_KEY | api, worker | yes |
| S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY | api, worker | yes |
| GOTENBERG_URL | worker | yes |
| ANTHROPIC_API_KEY | worker | yes |
| TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET | bot, worker | yes |
| EKAER_USER, EKAER_PASSWORD, EKAER_SIGNING_KEY, EKAER_TAX_NUMBER | worker | yes |
| BILLINGO_API_KEY | worker | yes |
| API_BASE_URL | web, bot, scale-agent | yes |
