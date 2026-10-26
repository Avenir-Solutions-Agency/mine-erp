# Mészkő-Polgár ERP 2.0

ERP for the Mészkő-Polgár Kft. limestone quarry. v1: weigh tickets and delivery notes → registered shipments → automatic EKÁER reports.

## Source of truth

- `docs/PRD.md`: what we build and what is out of scope
- `docs/ARCHITECTURE.md`: structure, boundaries, intentional decisions
- `docs/DESIGN_SYSTEM.md`: UI tokens and components
- `docs/SECURITY.md`, `docs/TASKS.md`
- `AGENTS.md`: rules for AI coding agents (and a good summary for humans)

## Setup

Requires Node.js 22 (`.nvmrc`) and pnpm 10.

```sh
pnpm install
cp .env.example apps/web/.env.local   # fill in values
pnpm dev                              # web on http://localhost:3000
```

## Scripts

| Script                              | What it does                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                          | all dev servers (turbo)                                       |
| `pnpm build`                        | production build                                              |
| `pnpm lint` / `pnpm typecheck`      | ESLint / `tsc --noEmit`                                       |
| `pnpm test`                         | unit tests (Vitest)                                           |
| `pnpm test:e2e`                     | end-to-end tests (Playwright, builds and serves web on :3100) |
| `pnpm format` / `pnpm format:check` | Prettier                                                      |
