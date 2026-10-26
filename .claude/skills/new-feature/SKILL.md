---
name: new-feature
description: Implement a v1 feature from docs/PRD.md end to end - plan, thin vertical slices, tests, definition of done, task list update. Use when the user asks to build a feature listed in the PRD or in docs/TASKS.md.
argument-hint: "<feature id or task id, e.g. F3 or T-008>"
---

# New feature: $ARGUMENTS

1. Find the feature in PRD §05 and its tasks in docs/TASKS.md. Restate the user action, the "done when" and the out-of-scope neighbours (§07). Not in the PRD: stop and ask whether to add it there first. Depends on a PRD §08 open question: ask.
2. Read docs/ARCHITECTURE.md (where code goes, boundaries, §06), docs/SECURITY.md for EKÁER, Telegram, uploads or personal data, and docs/DESIGN_SYSTEM.md for UI. Locate existing code with `graphify query`.
3. Plan in plan mode, or present a plan: vertical slices (domain rule → db/contracts → API endpoint or workflow activity → UI), files and tests per slice, risks. More than five files in a slice, or anything in ARCHITECTURE §08: ask. Wait for approval.
4. Branch `feat/<id>-<slug>`.
5. Per slice: tests first for domain and service logic (Arrange-Act-Assert), implement, run tests and typecheck, `graphify update .`.
6. Finish: every "done when" is observable; OpenAPI updated; events logged; loading, empty and error states; Hungarian copy; 375px; TASKS.md boxes ticked; docs updated if structure or decisions changed.
7. Suggest `/review-changes` before the pull request.
