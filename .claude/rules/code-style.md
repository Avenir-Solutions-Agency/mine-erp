# Code style

- TypeScript strict. No `any` (use `unknown` and narrow). No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- File names kebab-case (`user-card.tsx`); components PascalCase; hooks `useThing` in `use-thing.ts`.
- Named exports only, except where the framework requires a default export (Next.js `page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`).
- Imports use the `@/` alias for `src/` inside an app, and workspace package names (`@mine-erp/domain`) across packages. No `../../../` chains.
- One function, one job. Name it by what it does (`sendInvoiceEmail`, not `handleEmail2`).
- Never swallow errors. Catch only where you can handle them or add context; log unexpected errors once.
- Modules that touch the database, integrations or secrets import `server-only` in apps/web. Client components start with `"use client"` and stay at the leaves of the tree.
- Money as integer fillér (`bigint`), weight as integer kg, time as UTC `Date`/ISO; convert only at the display edge.
- Comments explain why, not what. No commented-out code. No TODO without a task id (`T-###`).
- Formatting belongs to Prettier; a hook formats every file you edit. Do not hand-format.
