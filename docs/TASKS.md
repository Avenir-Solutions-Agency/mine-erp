# Tasks

Derived from docs/PRD.md §05 and the spec's phase 1. Small tasks (at most a day). Tick a box only when AGENTS.md §07 is met. IDs: T-###; feature refs: F#.

## Now
- [ ] T-001 Local infra: `infra/docker-compose.yml` with PostgreSQL 17, Temporal dev server, Keycloak, MinIO, Gotenberg
- [ ] T-002 `packages/domain` skeleton with Vitest; shared tsconfig and lint setup for packages
- [ ] T-003 `packages/db`: Drizzle setup, migrations, the eleven phase-1 tables with UUIDv7, audit columns and DB rules (unique ticket number + year, unique SHA-256, net = gross − tare check)
- [ ] T-004 `packages/contracts`: Zod schemas for document, shipment, master data
- [ ] T-005 `apps/api` NestJS skeleton: health, OpenAPI 3.1, Keycloak OIDC guard, event_log writer

## Next
- [ ] T-006 (F7) Master data CRUD API: customer, delivery_address, product (with aliases), vehicle (plate normalization), person
- [ ] T-007 (F7) Billingo partner import into `customer`
- [ ] T-008 (F3) Validation rules in `packages/domain` as pure functions with codes and Hungarian messages (≥ 90% coverage)
- [ ] T-009 `apps/worker` Temporal skeleton; `ProcessDocumentWorkflow` with ingest → notify steps as stubs
- [ ] T-010 (F1) Ingest activity: object store upload, SHA-256, `document` record, duplicate detection
- [ ] T-011 (F2) `packages/extraction`: Claude vision tool-use schema, prompt versioning, evaluation script on the labelled set
- [ ] T-012 (F4) Normalize, link and register activities; gapless registry number sequence
- [ ] T-013 (F5) `packages/ekaer`: XML builder, SHA-512 request signature, XSD validation (unit-tested against the NAV FAQ example)
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
