---
paths:
  - "packages/db/**"
  - "**/*.schema.ts"
  - "**/repositories/**"
  - "**/drizzle.config.*"
---

# Database (PostgreSQL 17 + Drizzle)

- Schema changes (new table, removed or renamed column, index or constraint change) need approval: docs/ARCHITECTURE.md §08.
- Migrations through drizzle-kit, expand–contract only (forward compatible). Never edit an applied migration; destructive migrations need explicit approval.
- Every table: UUIDv7 primary key, `created_at`, `updated_at`, `created_by`. Business numbers come from a gapless sequence, not the id.
- Enforce rules in the database too: unique (ticket number, year), unique file SHA-256, `CHECK (net = gross - tare)`, at most one non-deleted `ekaer_report` per shipment.
- `event_log` is append-only (grants); never UPDATE or DELETE it.
- Money `bigint` fillér, weight integer kg, timestamps `timestamptz` in UTC.
- Queries live in repositories in `packages/db` or `apps/api`; services call them; nothing else touches the tables.
- Validate at the boundary with Zod; use the query builder or parameterized `sql`, never string-built SQL.
- Reads: select only needed columns; paginate lists; an index for every hot-path query; no N+1 loops.
- Writes that must succeed together, including their `event_log` row, use one transaction.
- Seed and backfill scripts are idempotent and safe to run twice.
