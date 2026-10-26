---
paths:
  - "apps/web/src/components/**"
  - "apps/web/src/app/**/*.tsx"
  - "apps/web/src/app/globals.css"
  - "packages/ui/**"
---

# UI components

- Before creating or changing UI, read docs/DESIGN_SYSTEM.md if you have not in this session.
- Tokens only: colors, spacing, radius and typography from DESIGN_SYSTEM.md. No raw hex or oklch, no arbitrary values like `p-[13px]`.
- Reuse the `apps/web/src/components/ui` primitives first. A new primitive needs approval and a DESIGN_SYSTEM.md §06 entry in the same change.
- Every data-driven view has loading, empty and error states.
- Office screens are designed for 1280px and still work at 375px; mobile views (driver, scale operator) are 375px first with 44px touch targets. No horizontal scroll except tables.
- Accessibility: semantic HTML, visible labels, `aria-label` on icon-only buttons, visible focus ring, AA contrast, status never colour-only.
- Server components by default. `"use client"` only for state, effects or browser APIs, as deep in the tree as possible.
- All copy is Hungarian through i18n keys and follows the tone rules in DESIGN_SYSTEM.md §01. Numbers, dates, Ft and kg use hu-HU formatting.
