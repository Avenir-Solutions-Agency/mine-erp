# Security: Mészkő-Polgár ERP 2.0

Read before changing auth, EKÁER, Telegram, uploads, secrets, personal data or deletion. Where this file is stricter than AGENTS.md §05, this file wins. Principle: least privilege, every secret in the secret store, every action traceable. Source: spec §11.

## 01 What we protect

| Data | Examples | Sensitivity | Where stored | Retention |
| --- | --- | --- | --- | --- |
| Staff personal data | name, phone, Telegram user id, Supabase Auth user id | personal data (GDPR) | `person` | until erasure request or end of employment |
| Vehicle data | plate numbers, country codes | personal data when linked to a driver | `vehicle`, `shipment` | accounting retention (configurable) |
| Document images | weigh ticket and delivery note photos | business + personal data | S3 object store (EU), SHA-256 | accounting retention (configurable) |
| EKÁER evidence | request/response XML (without credentials) | legal evidence | S3 object store | per legal requirement |
| Credentials | EKÁER password and signing key, Telegram token, OpenAI key, Billingo keys, scale agent tokens | secret | secret store only | rotated |
| Audit trail | `event_log`, login and permission changes | integrity-critical | PostgreSQL (append-only) | permanent |

The client is the data controller; we are the processor (annex 4).

## 02 Trust boundaries

- Browser → API: untrusted. Validate with Zod at the controller.
- Telegram webhook: verify `X-Telegram-Bot-Api-Secret-Token` before parsing; accept only allow-listed `chat_id`s and registered senders (`from.id` → `person.telegram_user_id`). Unknown senders are not processed; the admin is notified.
- Scale agent → API: HTTPS with a per-device token; idempotency key = ticket number.
- AI output (OpenAI extraction): untrusted input. Validate against the schema; never auto-link fuzzy matches.
- EKÁER, Billingo and other third-party responses: untrusted input.
- AI agents: own Supabase Auth user with a narrow role (Supabase has no service accounts; open decision: token lifetime and rotation for agent users); every write tool call passes the policy engine first.

## 03 Authentication and authorization

- Provider: Supabase Auth (project in an EU region). 2FA (TOTP MFA) is mandatory for office users: the API rejects office sessions below `aal2`; mobile uses PIN or QR card with short-lived tokens.
- Roles (phase 1): system operator, EKÁER admin, office user, scale operator, driver, read-only manager, agent (service account).
- Every API entry point checks the session and the role; authorization is decided in the API layer, never only in the UI.
- Always human approval: EKÁER modify/delete/correction, an EKÁER submission that fails the rules, and policy changes.

## 04 Secrets

- Stored in Vaultwarden or OpenBao (production, test) and `.env.local` (development). Never in git, never in `NEXT_PUBLIC_*`, never in logs, error messages or Sentry (redaction filter).
- Services read secrets at start-up.
- The Supabase secret key bypasses row-level security: api and worker only, never web, never `NEXT_PUBLIC_*`. The publishable key is public by design.
- Supabase is a sub-processor of personal data: EU region only, listed in the data processing agreement.
- OpenAI is a sub-processor for invoice extraction and for reading paper weigh tickets and delivery notes (T-011; they carry names, addresses, plate numbers and signatures): API data is not used for training; the project must use EU data residency and be listed in the data processing agreement before real invoices are processed in production.
- Issued weigh tickets are archived once in the private `weigh-tickets` bucket (no upsert) with their SHA-256 on the weighing; downloads return the stored file, and a void adds a separate SZTORNÓ copy.
- Supabase Auth: public sign-up is off; office users are created by an admin. After the password, every office user completes TOTP (authenticator app; QR enrolment on first sign-in at `/login/mfa`); the API accepts only `aal2` sessions and verifies tokens locally against the project JWKS (ES256), refusing `none` and HS* algorithms. `AUTH_REQUIRE_AAL2=false` is for local development only. Invoice files live in the private `invoices` bucket, reachable only through 5-minute signed links from the API.
- EKÁER uses a secondary user with its own signing key; the password is sent only as its SHA-512 hash.
- Rotation: by the system operator through the secret store (owner to be named).

## 05 Input, output, injection

- SQL: Drizzle query builder or parameterized `sql` only; never string-concatenated SQL.
- No `dangerouslySetInnerHTML` without sanitization.
- Uploads: images (JPEG, PNG, HEIC, WebP) and PDF only; size limit to be set (assumed 20 MB — confirm); stored in the object store with SHA-256; served only through authorized, short-lived URLs.
- Rate limits: Telegram webhook and upload endpoints (limits to be set).
- `event_log` is append-only by database grants.

## 06 Dependencies

- New dependency → ask first. Dependabot or Renovate, static analysis in CI, OWASP ASVS level 2 self-check before go-live.

## 07 Incident basics

- Contact: the client's system operator (to be named). A leaked secret: rotate first, then clean the history.
- The auto-EKÁER policy switch turns off automatic submission immediately; use it on any doubt.
