# Security: Mészkő-Polgár ERP 2.0

Read before changing auth, EKÁER, Telegram, uploads, secrets, personal data or deletion. Where this file is stricter than AGENTS.md §05, this file wins. Principle: least privilege, every secret in the secret store, every action traceable. Source: spec §11.

## 01 What we protect

| Data | Examples | Sensitivity | Where stored | Retention |
| --- | --- | --- | --- | --- |
| Staff personal data | name, phone, Telegram user id, Keycloak id | personal data (GDPR) | `person` | until erasure request or end of employment |
| Vehicle data | plate numbers, country codes | personal data when linked to a driver | `vehicle`, `shipment` | accounting retention (configurable) |
| Document images | weigh ticket and delivery note photos | business + personal data | S3 object store (EU), SHA-256 | accounting retention (configurable) |
| EKÁER evidence | request/response XML (without credentials) | legal evidence | S3 object store | per legal requirement |
| Credentials | EKÁER password and signing key, Telegram token, Claude, Billingo keys, scale agent tokens | secret | secret store only | rotated |
| Audit trail | `event_log`, login and permission changes | integrity-critical | PostgreSQL (append-only) | permanent |

The client is the data controller; we are the processor (annex 4).

## 02 Trust boundaries

- Browser → API: untrusted. Validate with Zod at the controller.
- Telegram webhook: verify `X-Telegram-Bot-Api-Secret-Token` before parsing; accept only allow-listed `chat_id`s and registered senders (`from.id` → `person.telegram_user_id`). Unknown senders are not processed; the admin is notified.
- Scale agent → API: HTTPS with a per-device token; idempotency key = ticket number.
- AI output (Claude extraction): untrusted input. Validate against the schema; never auto-link fuzzy matches.
- EKÁER, Billingo and other third-party responses: untrusted input.
- AI agents: own Keycloak service account with a narrow role; every write tool call passes the policy engine first.

## 03 Authentication and authorization

- Provider: Keycloak OIDC. 2FA is mandatory for office users; mobile uses PIN or QR card with short-lived tokens.
- Roles (phase 1): system operator, EKÁER admin, office user, scale operator, driver, read-only manager, agent (service account).
- Every API entry point checks the session and the role; authorization is decided in the API layer, never only in the UI.
- Always human approval: EKÁER modify/delete/correction, an EKÁER submission that fails the rules, and policy changes.

## 04 Secrets

- Stored in Vaultwarden or OpenBao (production, test) and `.env.local` (development). Never in git, never in `NEXT_PUBLIC_*`, never in logs, error messages or Sentry (redaction filter).
- Services read secrets at start-up.
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
