---
name: ui-component
description: Build or change a React UI component the project's way - design tokens from docs/DESIGN_SYSTEM.md, reuse of the ui primitives, all states, responsive, accessible, Hungarian copy. Use when creating or modifying components or pages in apps/web.
paths:
  - "apps/web/src/components/**"
  - "apps/web/src/app/**/*.tsx"
---

# UI component workflow

1. Read docs/DESIGN_SYSTEM.md and `apps/web/AGENTS.md` (Next.js 16 rules) if you have not in this session. List the primitives in `apps/web/src/components/ui`.
2. Reuse, then compose, then create. A new primitive only if nothing fits: ask first, add it with the shadcn CLI (`components.json`, style base-nova), and add it to DESIGN_SYSTEM.md §06 in the same change.
3. Tokens only (no raw colours, no off-scale spacing). Typography roles from §03; plates and numbers in the Data role with `tabular-nums`.
4. States: default, hover, focus-visible, active, disabled, loading. Data views: loading, empty, error.
5. Office screens 1280px first and still usable at 375px; mobile views 375px first, touch targets at least 44px.
6. Accessibility: semantic elements, labels, `aria-label` for icon-only buttons, visible focus ring, AA contrast, status with text not only colour.
7. Copy in Hungarian through i18n keys; hu-HU number, date, Ft and kg formatting.
8. Server component unless it needs state, effects or browser APIs; `"use client"` at the leaf.
9. Verify: typecheck; with the Playwright MCP server or `/verify`, check 375px and 1280px.
