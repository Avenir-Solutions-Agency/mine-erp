---
paths:
  - "**/*.test.{ts,tsx}"
  - "**/*.spec.{ts,tsx}"
  - "**/tests/**"
  - "**/e2e/**"
  - "**/vitest.config.*"
  - "**/playwright.config.*"
---

# Testing

- Unit tests (Vitest) cover business logic: `packages/domain` (pure rules, state machines, EKÁER mapping; ≥ 90% coverage) and API/worker services. End-to-end tests (Playwright) only for the critical flows in docs/PRD.md §05.
- Structure every test as Arrange-Act-Assert, with a blank line between the three parts.
- Default to state-based (Chicago school) tests: real domain objects, assertions on outputs and state. Mock only at the boundaries: vendor clients (EKÁER, Telegram, Billingo, Claude), the clock, randomness.
- Integration tests use Testcontainers (PostgreSQL) and the Temporal test environment, not mocks of the database.
- Contract tests replay recorded request/response pairs; never call real third-party services, and never the EKÁER production endpoint.
- Test names state the behaviour: `returns 409 when the ticket number already exists this year`.
- A bug fix starts with a failing test that reproduces the bug.
- Deterministic tests: fixed time (`vi.setSystemTime`), seeded data, no order dependence.
- Commands: `pnpm test` (unit), `pnpm test:e2e` (e2e). A task is not done while tests fail.
