---
description: Review the current changes against this project's rules (PRD scope, DESIGN_SYSTEM tokens, ARCHITECTURE boundaries, AGENTS.md definition of done) with the project subagents. Read-only.
argument-hint: "[base-branch or commit-range]"
allowed-tools:
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git branch *)
---

# Review changes

## Context

- Branch: !`git branch --show-current`
- Working tree: !`git status --short`
- Changed files vs HEAD: !`git diff --stat HEAD`
- Recent commits: !`git log --oneline -10`

## Scope

Review `$ARGUMENTS` if given (a base branch such as `main`, or a range such as `abc123..HEAD`). Otherwise review the uncommitted changes plus the commits on this branch that are not on the default branch.

## Steps

1. Get the full diff for the range. Group the changed files by area: UI, API/worker/bot, domain, database, config, tests, docs.
2. Delegate in parallel:
   - `code-reviewer`: the range and the changed files.
   - `security-auditor`: only if the diff touches auth, sessions, permissions, EKÁER, webhooks, uploads, external input, secrets, personal data or data deletion.
   - `design-reviewer`: only if UI files changed.
3. While they run, check the project contract yourself:
   - PRD §07: nothing out of scope was built. Features meet their "done when".
   - ARCHITECTURE §05: no forbidden imports (domain doing I/O, web/bot/scale-agent importing db or vendor clients, api calling external systems directly, secrets in client code). Grep the changed files.
   - ARCHITECTURE §06: no "fix" of an intentional decision.
   - DESIGN_SYSTEM: no raw colours or off-scale spacing in changed UI; loading, empty and error states exist; copy is Hungarian.
   - AGENTS.md §07: new logic has tests; OpenAPI and migrations updated; writes log events; docs changed if structure, decisions or components changed.
4. Merge and deduplicate the findings. Output:
   - Verdict: **Ready for PR** or **Changes required**.
   - Table: `Severity (Blocker / Major / Minor / Nit) | File:line | Finding | Suggested fix`.
   - "Checked, no issues": one line per area.
5. Do not edit files. Offer to fix the Blockers and Majors.

Deeper passes: bundled `/code-review` (correctness bugs; effort levels; `--fix`), `/security-review` (branch diff against origin), bundled `/simplify` (cleanup), `/ponytail-review` (unneeded code).
