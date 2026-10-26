# Design System: Mészkő-Polgár ERP 2.0

Every visual decision lives here so the agent never invents one. The tokens below are the ones already in `apps/web/src/app/globals.css` (shadcn/ui `base-nova`, neutral base). Keep the token names: the code references them.

## 01 Brand identity

- Personality: calm, precise, dense.
- Tone in UI copy: Hungarian, plain, short sentences, no exclamation marks. State what happened and what to do next ("Ellenőrzésre vár: a rendszám nem olvasható").
- Feel: an internal work tool. Data first, compact tables, little decoration. Never busy.
- UI language and locale: hu-HU only in v1, through i18n keys (no hard-coded copy). Dates `2026. 10. 26. 14:05` in Europe/Budapest; money `24 360 Ft` (stored in fillér); weight `24 360 kg` (non-breaking space as thousands separator).
- Reference sites we like: none yet.

## 02 Color palette

Use tokens in components (`bg-primary`, `text-muted-foreground`, `border-border`). Never raw hex or oklch values in components.

| Token | Value (light) | Use |
| --- | --- | --- |
| --background | oklch(1 0 0) | Page background |
| --foreground | oklch(0.145 0 0) | Body text |
| --card / --card-foreground | oklch(1 0 0) / oklch(0.145 0 0) | Cards, panels |
| --popover / --popover-foreground | oklch(1 0 0) / oklch(0.145 0 0) | Menus, popovers |
| --muted / --muted-foreground | oklch(0.97 0 0) / oklch(0.556 0 0) | Subtle surfaces / secondary text, captions |
| --secondary / --secondary-foreground | oklch(0.97 0 0) / oklch(0.205 0 0) | Secondary buttons |
| --accent / --accent-foreground | oklch(0.97 0 0) / oklch(0.205 0 0) | Hover rows, selected items |
| --primary / --primary-foreground | oklch(0.205 0 0) / oklch(0.985 0 0) | Main action, links, active states |
| --border / --input | oklch(0.922 0 0) | Dividers, input borders |
| --ring | oklch(0.708 0 0) | Focus ring |
| --destructive | oklch(0.577 0.245 27.325) | Errors, destructive actions, `failed` / `rejected` |
| --success / --success-foreground | oklch(0.627 0.17 149) / oklch(0.985 0 0) (assumed — confirm) | `registered`, `ekaer_reported`, confirmations |
| --warning / --warning-foreground | oklch(0.666 0.157 58) / oklch(0.145 0 0) (assumed — confirm) | `needs_review`, non-blocking warnings |
| --chart-1 … --chart-5 | neutral ramp | Charts only |
| --sidebar-* | see globals.css | App sidebar |

Rules:
- One primary colour. Accent colours are for state, not decoration. The neutral primary is a placeholder until the brand colour arrives (PRD §08).
- Status is never colour-only: every status badge also has its Hungarian label.
- Text on any background passes WCAG AA (4.5:1 for body text).
- Dark mode: not supported in v1. The `.dark` values stay in globals.css; never hard-code a colour.

## 03 Typography

Geist Sans (UI) and Geist Mono (codes, plates, numbers in tables), loaded with `next/font`.

| Role | Font | Size | Weight | Line height |
| --- | --- | --- | --- | --- |
| H1 | Geist | 24px | 600 | 1.25 |
| H2 | Geist | 20px | 600 | 1.3 |
| H3 | Geist | 16px | 600 | 1.4 |
| Body | Geist | 14px | 400 | 1.5 |
| Small | Geist | 12px | 400 | 1.4 |
| Label | Geist | 12px | 500 | 1.4 |
| Data | Geist Mono | 13px | 400 | 1.4, `tabular-nums` |

Rules:
- Dense by default: body 14px (assumed — confirm). Numbers in tables are right-aligned and `tabular-nums`.
- Plates, registry numbers and EKÁER numbers use the Data role.
- Never more than two font families on a page.

## 04 Spacing

Base unit: 4px. Only values from the Tailwind scale (`1` = 4px).

| Token | Value | Typical use |
| --- | --- | --- |
| 1 | 4px | Icon gaps |
| 2 | 8px | Inside small components, table cell padding |
| 3 | 12px | Input padding, form field gaps |
| 4 | 16px | Default gap between elements, card padding |
| 6 | 24px | Between groups |
| 8 | 32px | Between sections |

Layout:
- Office screens: sidebar + full-width content; tables may use the full width.
- 16px side padding on mobile.

## 05 Border radius and shadows

`--radius` is 0.625rem (10px); the scale is derived in `@theme`.

| Token | Value | Use |
| --- | --- | --- |
| radius-sm | 6px | Tags, badges, small buttons |
| radius-md | 8px | Inputs |
| radius-lg | 10px | Buttons, cards, modals |
| radius-full | 9999px | Avatars, pills |

Shadows: one level only, for elevated surfaces (dropdowns, modals). Flat cards get a border, not a shadow.

## 06 Components

Reuse before creating. Primitives live in `apps/web/src/components/ui/` (shadcn/ui on `@base-ui/react`): `button`, `input`, `label`, `card`, `dialog`, `empty-state`. If a variant is not listed here, ask before adding it.

Buttons (`button.tsx`)

| Variant | Background | Text | Use |
| --- | --- | --- | --- |
| default | primary | primary-foreground | One per screen, the main action |
| secondary | secondary | secondary-foreground | Supporting actions |
| outline | background + border | foreground | Toolbar and filter actions |
| ghost | transparent | foreground | Low-emphasis actions, table rows |
| destructive | destructive/10 | destructive | Destructive actions, always confirm |
| link | transparent | primary | Inline navigation |

- Sizes: `default` 32px, `lg` 36px; on touch screens use at least 44px hit areas.
- States: hover, focus-visible ring (`ring-ring/50`), disabled 50% opacity, `aria-invalid` destructive ring.
- Loading: a spinner replaces the label, width stays fixed, the button is disabled.

Inputs
- Label above the field, 12px, always visible. Placeholder is a hint, never the label.
- Error: `aria-invalid`, destructive border, message below at 12px.
- Low-confidence extracted fields (review queue) get the warning border plus the confidence as text.

Cards
- `card` background, radius-lg, padding 4, 1px border. No shadow unless interactive.

Modals (Dialog)
- Max width 384px (`sm:max-w-sm`), radius-xl, dimmed overlay. Closes on overlay click and on Escape (Base UI default).

Empty states
- One line saying what belongs here, plus one primary action. Never a blank panel.

Data tables
- TanStack Table (when added). Sticky header, right-aligned numbers, status badge column, row click opens detail.

## 07 Icons

- Set: Lucide (`lucide-react`). One set only.
- Sizes: 16px inline and in buttons (the Button default), 20px standalone.
- An icon is never the only label on an action. Add text or an `aria-label`.

## 08 Responsive breakpoints

| Name | Min width | Notes |
| --- | --- | --- |
| sm | 640px | Phones in landscape |
| md | 768px | Tablets |
| lg | 1024px | Laptops, sidebar appears |
| xl | 1280px | Desktops |

Rules:
- Every screen works at 375px wide; the office screens are designed for 1280px first, mobile views (driver, scale operator) for 375px first.
- Touch targets are at least 44px on mobile views.
- No horizontal scrolling anywhere except tables and code blocks.

## 09 Motion

- 150ms for micro interactions, 250ms for panels (`tw-animate-css`).
- Respect `prefers-reduced-motion`: disable non-essential animation.

## 10 Implementation

- Tokens live in `apps/web/src/app/globals.css` as CSS variables with the names above, exposed to Tailwind through `@theme inline` (Tailwind v4). This file and globals.css change in the same commit.
- Primitives live in `apps/web/src/components/ui/` (shadcn/ui `base-nova`, restyled only through these tokens). Shared primitives move to `packages/ui` once a second app needs them.
- Class merging: `cn` from `@/lib/utils`.
- Anything not defined here: ask before inventing it.
