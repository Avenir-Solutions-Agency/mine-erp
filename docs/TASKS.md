# Tasks

Derived from docs/PRD.md §05 and the spec's phase 1. Small tasks (at most a day). Tick a box only when AGENTS.md §07 is met. IDs: T-###; feature refs: F#.

## Now
- [ ] T-001 Local infra: `infra/docker-compose.yml` with Temporal dev server and Gotenberg; hosted Supabase dev project (EU) for PostgreSQL, auth and storage; `.env.example` names
- [x] T-002 `packages/domain` skeleton with Vitest; shared tsconfig and lint setup for packages (done in T-023)
- [ ] T-003 `packages/db`: Drizzle setup, migrations, the eleven phase-1 tables with UUIDv7, audit columns and DB rules (unique ticket number + year, unique SHA-256, net = gross − tare check)
- [ ] T-035 The ERP's own weighbridge (decided 2026-10-29, PRD §08): `packages/domain/weighing` rules, `weighing` table with gapless MJ-YYYY-NNNNNN numbers, API endpoints with live weight from `apps/scale-agent` (simulator), Mérleg screen. Open: real indicator reader (model and interface unknown), ticket PDF, plate camera, EKÁER from a weighing, customer/product master data, legal-metrology check
- [ ] T-034 Real incoming invoices (decided 2026-10-29, pulls part of PRD §07 phase 4 forward): (a) `packages/db` tables `vehicle`, `machine`, `incoming_invoice`, `incoming_invoice_line`, `event_log` with RLS on, seed from the vehicle and machine workbooks (`packages/db/seed-data/`, gitignored); (b) `apps/api` upload → OpenAI extraction (Zod-validated) → Supabase Storage `invoices/YYYY-MM/` by issue date, Supabase email+password login (TOTP/`aal2` before production); (c) Számlák page on the API with the invoice-image modal and print
- [ ] T-004 `packages/contracts`: Zod schemas for document, shipment, master data
- [x] T-005 `apps/api` NestJS skeleton: health, OpenAPI 3.1, Supabase JWT guard (JWKS, `aal2` for office users), event_log writer. OpenAPI 3.1 is generated from the Zod contracts (`packages/contracts/openapi.json`); tests fail when it drifts from the API routes

## Prototype track (PRD §05a)
Port of `docs/reference/demo.html`; the checklist per screen is in `docs/demo-inventory/`.
- [x] T-022 App shell: 232px side rail, final navigation (6 groups, 30 routes, badges), mobile top bar, toast; primitives pill, tabs, table, KPI, bar (DESIGN_SYSTEM §06)
- [x] T-023 `packages/domain` skeleton (covers T-002) + the demo engine (`src/demo/`): state, seed and every rule of the demo in source order; golden test against the original page state
- [x] T-024 Web store: one engine instance in the browser (`useSyncExternalStore`), toasts, navigation, nav badge counts
- [x] T-025 Áttekintés: dash (incl. 13-week cash flow, charts), today, ai (approvals)
- [x] T-026 Értékesítés: inbox (inquiry parsing), quotes, contracts, orders, portal; PDF/XLSX order intake (pdfjs-dist; XLSX waits for the xlsx dependency decision)
- [x] T-027 Logisztika I: dispatch (suggestion, auto-assign, driving and rest limits), transport and EKÁER, scale (ANPR)
- [x] T-028 Logisztika II: driver app (POD, signature), telem (SVG map), dn, tig, billing, integr (outbox)
- [x] T-029 Üzem: stock, store, qr (qrcode, jsqr), operapp, mechapp, waste, machines
- [x] T-030 Pénzügy and Projekt: reports and pricing (what-if, profitability, plan vs actual), payroll (CSV export), plan
- [ ] T-031 AI features ("Kérdezze az ERP-t", inquiry re-parse, "Ma" summary): server-side endpoint, Zod-validated output. Needs approval: Anthropic SDK + `ANTHROPIC_API_KEY`
- [x] T-032 E2E smoke over all 30 routes at 1280px and 375px
- [x] T-033 (demo data replaced by T-034) Incoming invoice portal (the boss's demo, mpkft-szamlaportal-demo.netlify.app) as the Számlák › Bejövő számlák tab: invoices, lines, cost carriers, upload; logic in `packages/domain/src/demo/invoices.ts`

## Next
- [ ] T-006 (F7) Master data CRUD API: customer, delivery_address, product (with aliases), vehicle (plate normalization), person
- [ ] T-007 (F7) Billingo partner import into `customer`
- [ ] T-008 (F3) Validation rules in `packages/domain` as pure functions with codes and Hungarian messages (≥ 90% coverage)
- [x] T-009 `apps/worker` Temporal skeleton; `ProcessDocumentWorkflow` with ingest → notify steps as stubs
- [ ] T-010 (F1) Ingest activity: object store upload, SHA-256, `document` record, duplicate detection
- [ ] T-011 (F2) `packages/extraction`: Claude vision tool-use schema, prompt versioning, evaluation script on the labelled set
- [ ] T-012 (F4) Normalize, link and register activities; gapless registry number sequence
- [x] T-013 (F5) `packages/ekaer`: XML builder, SHA-512 request signature, XSD validation (unit-tested against the NAV FAQ example)
- [ ] T-014 (F5) `EkaerReportWorkflow`: obligation decision, create with query-before-resend, finalize, human-approved modify/delete/correction
- [ ] T-015 (F1, F6) `apps/bot`: grammY webhook with secret token, allow-listed chats, photo/document/album intake, reply-and-edit confirmations, `/allapot`, `/ma`, `/segitseg`
- [ ] T-016 (F1) Web upload page
- [ ] T-017 (F3) Web review queue: zoomable photo next to the extracted form, low-confidence fields highlighted, resume via signal
- [ ] T-018 (F4) Web shipment register list and detail
- [ ] T-019 (F1) `apps/scale-agent`: adapter interface, SQLite buffer, heartbeat, `POST /scale/tickets` (first adapter after the scale survey)
- [ ] T-020 Policy engine minimum: auto-EKÁER switch, agent modes
- [ ] T-021 E2E: photo upload → review queue → register → EKÁER number (against the EKÁER test environment)

## Later (after v1)
- [ ] Observability: OpenTelemetry, Grafana dashboards, alerts (spec §12)
- [ ] Terraform for test and production on Hetzner; CD pipeline
- [ ] Phase 2: quotes, orders, contracts, delivery signature, Billingo invoicing

## Done
