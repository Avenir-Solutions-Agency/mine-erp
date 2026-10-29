# PRD: Mészkő-Polgár ERP 2.0

Status: Draft · Last updated: 2026-10-26

Source of detail: `docs/Mészkő-Polgár ERP 2.0 – fejlesztői specifikáció.md` (the spec). This PRD covers v1 = spec phase 1, plus the clickable prototype of every phase (§05a).

## 01 Product overview

| Field | Value |
| --- | --- |
| Product name | Mészkő-Polgár ERP 2.0 |
| Tagline | Weigh tickets to EKÁER numbers in under a minute |
| Description | A new ERP for the Mészkő-Polgár Kft. limestone quarry (Polgárdi-Kőszárhegy). v1 takes weigh tickets and delivery notes from the scale, Telegram photos and web uploads, registers each shipment, and files the EKÁER report automatically when the rules allow it. Office staff only review the exceptions. |
| Stage | Idea (greenfield; nothing reused from the old Mine ERP) |
| Platform | Web app (Next.js, PWA later) + NestJS API + Telegram bot + local scale agent |

## 02 Problem

Today, scale operators and drivers post photos of weigh tickets and delivery notes into a Viber group, and the office retypes them into the register and into the NAV EKÁER portal by hand. This is slow, error-prone and depends on whoever is reading the group. A late or wrong EKÁER report is a legal and financial risk, and a lost photo means a shipment with no record.

Today, the office has to retype every ticket from chat photos into two systems because nothing reads the tickets or talks to EKÁER. This costs them hours per day and puts every shipment's EKÁER compliance on one person's attention.

## 03 Goal

Every weighed shipment is registered and, when required, has an EKÁER number within 60 seconds of the photo (30 seconds from scale data), and nobody retypes a ticket.

## 04 Target users

Primary user:
- Who: the EKÁER admin / office user at the quarry who registers shipments and files EKÁER reports.
- Trigger: a truck is weighed and leaves the quarry.
- Today they use: a Viber group with photos, manual typing into the register and the EKÁER portal.
- They will switch because: the system reads the ticket, files EKÁER itself when the rules pass, and only shows them the items that need a human.

Secondary users:
- Scale operator: posts or produces the weigh ticket (scale agent or Telegram photo); needs an instant confirmation.
- Driver: may post the delivery note photo from Telegram; needs to know it was recorded.
- System operator: manages master data, the auto-EKÁER policy switch and agent modes.
- Read-only manager: sees the daily summary.

Not for:
- External customers or carriers (no portal in v1).
- Accounting: the ERP is not a general ledger; financial items are exported later (phase 4).

## 05 Core features

| # | Feature | What the user can do | Done when |
| --- | --- | --- | --- |
| F1 | Document intake | Send a weigh ticket or delivery note by Telegram photo/file, web upload, or the scale agent | Each input creates exactly one `document` with SHA-256; an identical file is marked `duplicate` and the sender is told so |
| F2 | AI extraction | Have the photo read automatically | Every required field has a value and a 0–1 confidence stored in `extraction`, with model and prompt version |
| F3 | Validation and review queue | Review only the items that failed a rule, with the photo next to the form | Items failing any spec §5 rule land in `needs_review`; after saving, the workflow resumes from `validate` |
| F4 | Shipment register | See every shipment with its registry number | Valid documents are linked (ticket + note, plate, ±30 min) and get a gapless number like SZ-2026-000123, status `registered` |
| F5 | Automatic EKÁER reporting | Let the system file EKÁER for required products, or file it with one click | Against the EKÁER test environment: create, finalize, modify, delete and query succeed; a timeout never produces a duplicate report (query before resend) |
| F6 | Channel confirmation | Get the result where the document came from | The Telegram bot edits its reply to "Rögzítve: SZ-… · 22/63 · 24 360 kg · ABC123 → EKÁER: …" or "Ellenőrzésre vár: …" |
| F7 | Master data and partner import | Maintain customers, delivery addresses, products, vehicles and people; import partners from Billingo | Billingo partners import into `customer`; unknown plate, customer, address or product always routes to review (fuzzy match is only a suggestion) |

Key user flow:
1. A truck is weighed; the scale agent sends the ticket, or the operator posts a photo to the Telegram group.
2. The pipeline ingests, extracts, normalizes, validates, links and registers the shipment, then files EKÁER if required and allowed.
3. The sender gets a confirmation with the registry and EKÁER numbers; exceptions appear in the web review queue for the EKÁER admin.

## 05a Prototype track

Decided 2026-10-26: the demo page (`docs/reference/demo.html`, inventory in `docs/demo-inventory/`) is ported 1:1 into `apps/web` as a clickable prototype of all phases and the four add-on modules: every screen, control, rule and Hungarian string.

- Data: seeded in the browser, no database, reset on reload (as in the demo). Integrations (NAV EKÁER, Billingo, iTrack, ANPR, RFID, bank) stay simulated; the prototype never calls a real external system.
- Business rules from the demo (cost model, price engine, approvals, dispatch, EKÁER obligation, stock, payroll) go to `packages/domain` as tested pure functions, so the real backend reuses them.
- The prototype does not replace the phase-1 backend (T-001…T-021). A screen moves from prototype to real when its API exists.
- Exactly what the demo page has, nothing more and nothing less (decided 2026-10-26). Known demo quirks (inventory README) are kept as they are, and numbers are computed and rounded exactly as in the demo.

## 06 Success metrics

| Metric | Target | Measured by |
| --- | --- | --- |
| Required-field extraction accuracy on the labelled set (≥100 real photos) | ≥ 98%, and zero wrong items among auto-approved ones | `packages/extraction` evaluation script |
| Median time photo → EKÁER number | < 60 s (scale data: < 30 s) | Pipeline trace (OpenTelemetry) |
| Share of documents handled without human review | ≥ 80% after the pilot (assumed — confirm) | `document` status counts |
| Pilot parity with today's Viber process | 2 weeks in parallel with no discrepancy | Daily reconciliation during the pilot |
| Duplicate EKÁER reports | 0 | `ekaer_report` uniqueness + query-before-resend log |

## 07 Out of scope

Do not build these in v1 as production features (backend, database, real integrations), even if they look easy or obvious. Their prototype screens are in scope (§05a).

- Quotes, orders, contracts, delivery signatures and Billingo invoicing (spec phase 2). Only the Billingo partner import is v1.
- Trip planning, driver app, iTrack, stock and material balance, QR warehouse, machines (phase 3).
- Incoming invoices, bank, ledger export, payroll prep, controlling, "Ask the ERP" (phase 4).
- The four add-on modules (landfill, plate-recognition scale, machine log, mechanic mobile).
- Data migration from the old Mine ERP, or reuse of its code. (The demo page is ported as the prototype, §05a.)
- Real map tiles or a map provider (the prototype keeps the demo's SVG map), native mobile apps.

## 08 Open questions

Not decided yet. The agent must ask before assuming an answer.

- [Blocking, partly answered 2026-10-29] Scale software: Netto Scales PORTAL AI with an ERP API 1.2 (Bearer key, read and optional write) and a read-only SQLite file; see `docs/reference/portal-ai.md`. Still open: network path from the hosted ERP to the scale PC (VPN or the local scale agent), who issues the API key, and whether PORTAL or the ERP files EKÁER.
- [Blocking] EKÁER test environment request to NAV, and a secondary EKÁER user for the ERP under the client's primary user.
- [Blocking] Which products are EKÁER-required (VTSZ 2517, 2516, 2505), and with what weight or value threshold? Needs the accountant's or tax advisor's opinion.
- At least 100 real weigh ticket and delivery note photos from the Viber group, with the client's consent.
- What exactly is on the weigh ticket and the delivery note (fields, numbering), and which is made first?
- Who posts the document and when: the scale operator at weighing, or the driver? (EKÁER timing)
- Telegram group members, staff Telegram accounts, the bot name.
- Foreign carriers' vehicles: where do the plate and country code come from?
- Billingo access for the partner import.
- EKÁER value source: price list or order price?
- Production hosting: Docker Compose or k3s; self-hosted or managed Temporal (ADR). PostgreSQL, auth and storage: Supabase, EU region (decided 2026-10-28).
- Brand colour: decided 2026-10-26, the demo design wins (quarry green, IBM Plex + Barlow Condensed, dark mode). See DESIGN_SYSTEM.md.
- Target share of documents without human review (assumed 80% — confirm).

## 09 Glossary

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| Mérlegjegy (weigh ticket) | The scale's record of gross, tare and net weight for one weighing | Szállítólevél |
| Szállítólevél (delivery note) | The document that travels with the load to the customer | Mérlegjegy |
| Document | One received file or scale record (`document` table) | Shipment |
| Shipment | The central register record of one load, linking its documents (`shipment`) | Trip (phase 3) |
| Registry number | Gapless business number of a shipment, e.g. SZ-2026-000123 | UUIDv7 id |
| EKÁER | NAV's electronic road-freight control system; a report returns a `tcn` (EKÁER number) | Online Számla |
| Fraction code | Product size code, e.g. 22/63 | VTSZ |
| Bruttó / tára / nettó | Gross / tare / net weight in kg; net = gross − tare | — |
| Review queue | Web list of `needs_review` items | Approvals list (policy engine) |
