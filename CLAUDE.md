@AGENTS.md

<!--
Maintainer notes (block comments are stripped from Claude's context):
- AGENTS.md is the tool-agnostic rulebook. Only Claude Code-specific guidance lives here.
- Keep this file under 120 lines. Procedures go to .claude/skills, file-type rules to .claude/rules with `paths`.
- The graphify section that `graphify install --project` wrote was merged into the Harness map and Working agreements below.
-->

# Claude Code guide: Mészkő-Polgár ERP 2.0

## Snapshot
- Mészkő-Polgár ERP 2.0: weigh tickets and delivery notes → registered shipments → automatic EKÁER reports, for a limestone quarry. Stage: idea (greenfield, only apps/web exists).
- Stack: pnpm + Turborepo · Next.js 16 App Router · TypeScript strict · Tailwind v4 + shadcn/ui · NestJS · Temporal · PostgreSQL 17 + Drizzle · Keycloak · Docker on Hetzner.
- The truth lives in docs/: PRD (what and why), DESIGN_SYSTEM (how it looks), ARCHITECTURE (where code goes), SECURITY, TASKS. Read them as AGENTS.md §02 says; do not restate them here.

## Commands
`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm build` · `pnpm format`

## Harness map: use these instead of improvising
| When | Use |
| --- | --- |
| After a feature, before a PR | `/review-changes` (project rules + subagents) |
| Hunting correctness bugs in a diff | bundled `/code-review`; security pass: `/security-review` |
| Fixing a bug or an issue | `/fix-issue <number or description>` |
| Building a PRD feature | `/new-feature <F#>` |
| Deploying | `/deploy <test or production>`, only when I ask |
| Independent review | subagents `code-reviewer`, `security-auditor`, `design-reviewer` |
| Finding code, broad code search | `graphify query "<question>" --budget 1500`; relationships: `graphify path "<A>" "<B>"`; one concept: `graphify explain "<concept>"`; overview: graphify-out/GRAPH_REPORT.md (or graphify-out/wiki/index.md if it exists). Not Explore, not whole-file reads |
| The graph is stale | `graphify update .` (AST only, no API cost) |
| Building or changing the graph itself | the `/graphify` skill (.claude/skills/graphify/SKILL.md); when I type `/graphify`, use it before anything else |
| Too much code, over-engineering | Ponytail is always on (full); `/ponytail-review` on a diff, `/ponytail-audit` on the codebase |
| Token savings check | `headroom savings` (the proxy runs outside this session; never start, stop or reroute it) |
| UI work | the `ui-component` skill loads for UI files |
| Current library docs (NestJS, Temporal, Drizzle, Next 16) | the `context7` MCP server |
| Proving a change works in the running app | bundled `/verify` (after `/run-skill-generator` ran once), or the `playwright` MCP server |

## Working agreements (Claude Code)
- Plan first (plan mode or a written plan) when a task touches more than 5 files or anything in docs/ARCHITECTURE.md §08.
- Track multi-step work in the task list, one item in progress at a time.
- Verify before saying done: `pnpm typecheck` and the relevant tests. Say what you ran.
- Hooks in .claude/hooks enforce safety. If one blocks you, do not work around it: say what you wanted to run and why.
- Token budget (AGENTS.md §10): graph first. Before the first grep, search or source-file read for a codebase question, run `graphify query`, and put this rule in every subagent prompt that explores code. graph-first.sh blocks reading source files before the graph exists, full reads of large source files, unbounded content greps and `cat` dumps of source files. Query the graph, then read the exact lines.
- graphify-out/ is gitignored and rebuilt locally (post-commit hook); never commit it.
- Only change .claude/**, .mcp.json or CLAUDE.md when the task is about the harness itself.
- A convention I correct twice belongs in AGENTS.md or .claude/rules, not only in auto memory: propose the edit.

## Gotchas
- Next.js 16 differs from older versions: read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/` before web work. `next dev` re-adds the block in apps/web/AGENTS.md; commit it.
- `cn` comes from the `cn` package (shadcn), re-exported by `@/lib/utils`; there is no clsx or tailwind-merge.
- Run package scripts from the root through turbo, or with `pnpm --filter @mine-erp/web <script>`.
