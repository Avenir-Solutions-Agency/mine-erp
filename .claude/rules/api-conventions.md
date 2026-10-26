---
paths:
  - "apps/api/src/**"
  - "apps/worker/src/**"
  - "apps/bot/src/**"
  - "apps/scale-agent/src/**"
  - "apps/web/src/app/api/**"
  - "apps/web/src/app/**/actions.ts"
  - "packages/contracts/**"
  - "packages/ekaer/**"
  - "packages/extraction/**"
---

# API, workers, bots and services

- NestJS: thin controllers (authenticate, validate with a Zod schema from `packages/contracts`, call one service, map the result); guards for auth; logic in services; repositories touch the database.
- Authorization happens at the entry point (Keycloak session or service account + role). Services receive the actor; they never read the request.
- Never trust client-supplied ids for ownership, or client-supplied prices, weights or roles. Load them on the server.
- Response shape: success `{ data }`, error `{ error: { code, message } }` with the matching HTTP status (400, 401, 403, 404, 409, 422, 429, 500). Messages are Hungarian; never stack traces or vendor error text.
- Every endpoint is in the OpenAPI 3.1 contract; change both in the same commit.
- Every write appends to `event_log` in the same transaction (actor: person, agent or system).
- External systems are called only from Temporal activities in `apps/worker`: idempotency key, at most 3 retries with exponential backoff, then an approval item with the error.
- EKÁER: after a timeout or network error, `queryTradeCards` by `orderNumber` before any resend. Never retry validation errors.
- Webhooks: verify the signature or secret token before parsing; handlers are idempotent (store processed ids). The bot and the scale agent only create a `document` and start the workflow.
- Log unexpected errors once, with a request id; redact secrets.
- Public endpoints (Telegram webhook, scale tickets, uploads) are rate limited.
