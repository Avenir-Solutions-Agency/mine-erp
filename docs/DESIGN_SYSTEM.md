# Design System: Mészkő-Polgár ERP 2.0

Every visual decision lives here so the agent never invents one. The tokens below are the ones in `apps/web/src/app/globals.css`. Values come from the demo page (`docs/reference/demo.html`, inventory in `docs/demo-inventory/`), which is the visual reference for v1; names stay shadcn/ui (`base-nova`). Keep the token names: the code references them.

## 01 Brand identity

- Personality: calm, precise, dense.
- Tone in UI copy: Hungarian, plain, short sentences, no exclamation marks. State what happened and what to do next ("Ellenőrzésre vár: a rendszám nem olvasható").
- Feel: an internal work tool. Data first, compact tables, little decoration. Never busy.
- UI language and locale: hu-HU only in v1, through i18n keys (no hard-coded copy). Dates `2026. 10. 26. 14:05` in Europe/Budapest; money `24 360 Ft` (stored in fillér); weight `24 360 kg` (non-breaking space as thousands separator).
- Reference sites we like: none yet.

## 02 Color palette

Use tokens in components (`bg-primary`, `text-muted-foreground`, `border-border`). Never raw hex or oklch values in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| --background | #EDF0ED | #111715 | Page background (limestone grey) |
| --foreground | #18211F | #E4EBE8 | Body text |
| --card / --popover | #FFFFFF | #19211F | Cards, panels, menus (`*-foreground` = foreground) |
| --muted / --secondary | #F5F7F5 | #1F2826 | Subtle surfaces, secondary buttons |
| --muted-foreground | #5B6964 | #97A6A1 | Secondary text, captions, table headers |
| --primary / --primary-foreground | #1E6B58 / #FFFFFF | #5DC1A3 / #0D1A16 | Quarry green: main action, links, active states, focus ring |
| --accent / --accent-foreground | #DCEBE5 / #1E6B58 | #1D3A32 / #5DC1A3 | Hover, selected rows, active nav item |
| --ai / --ai-soft | #94580A / #F6E9D3 | #E6A84E / #3A2D18 | AI suggestions, approvals, nav counters |
| --success / --success-soft | #2B7A4B / #DDF0E3 | #72CF97 / #1C3527 | `registered`, `ekaer_reported`, confirmations |
| --warning / --warning-soft | #8A4F00 / #FBEBD2 | #F0B45A / #3A2B14 | `needs_review`, non-blocking warnings |
| --destructive / --destructive-soft | #B0281E / #F7DEDB | #F08A80 / #3D1F1C | Errors, destructive actions, `failed` / `rejected` |
| --border / --input | #D3DAD6 | #2E3936 | Dividers, input borders |
| --ring | = primary | = primary | Focus ring |
| --chart-1 … --chart-7 | see globals.css | see globals.css | Charts only, in this order |
| --map-water / --map-road | #CFE0EA / #C9B48A | #1F3442 / #6B5B3A | Telematics map only |
| --sidebar-* | see globals.css | see globals.css | App side rail |

Rules:
- One primary colour (quarry green). `ai`, `success`, `warning`, `destructive` are for state, not decoration.
- Status pills: `*-soft` background with the matching text colour, no border (demo `.pill.ok/.warn/.bad/.ai/.acc`; `acc` = accent).
- Status is never colour-only: every status badge also has its Hungarian label.
- Text on any background passes WCAG AA (4.5:1 for body text).
- Dark mode: supported, follows the OS (`prefers-color-scheme`, the `dark:` variant). Never hard-code a colour.

## 03 Typography

IBM Plex Sans (UI, `font-sans`), IBM Plex Mono (codes, plates, numbers in tables, `font-mono`) and Barlow Condensed (headings and KPI values, `font-heading`), loaded with `next/font` (latin + latin-ext).

| Role | Font | Size | Weight | Line height |
| --- | --- | --- | --- | --- |
| H1 | Barlow Condensed | 34px | 600 | 1, letter-spacing .01em, `text-balance` |
| H2 | Barlow Condensed | 21px | 600 | 1.3, letter-spacing .02em |
| H3 | Plex Sans | 13px | 600 | 1.4 |
| KPI value | Barlow Condensed | 30px | 600 | 1.1, `tabular-nums` |
| Body | Plex Sans | 14px | 400 | 1.5 |
| Control | Plex Sans | 13px | 500 | 1.4 (buttons, inputs, nav, tables) |
| Small | Plex Sans | 12px | 400 | 1.4 |
| Label / table header | Plex Sans | 11px | 500 | 1.4, uppercase, letter-spacing .07em, muted |
| Data | Plex Mono | 12px | 400 | 1.4, `tabular-nums` |

Rules:
- Dense by default: body 14px, controls 13px. Numbers in tables are right-aligned and `tabular-nums`.
- Plates, registry numbers and EKÁER numbers use the Data role.
- Only these three families.
- Tailwind classes: `text-h1`, `text-h2`, `text-control`, `text-label` (globals.css `@theme`, registered with `cn` in `src/lib/utils.ts`); `h1`–`h3` get their role by default.

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
- Office screens: 232px side rail + full-width content; tables may use the full width.
- 16px side padding on mobile.

## 05 Border radius and shadows

`--radius` is 0.375rem (6px, demo `--r`); the scale is derived in `@theme`.

| Token | Value | Use |
| --- | --- | --- |
| radius-lg | 6px | Default: buttons, inputs, cards, panels, toasts |
| radius-xl | 8.4px | Modals |
| radius-full | 9999px | Pills, badges, nav counters, step chips |

Shadows: one level only, for elevated surfaces (dropdowns, modals). Flat cards get a border, not a shadow.

## 06 Components

Reuse before creating. Primitives live in `apps/web/src/components/ui/` (shadcn/ui on `@base-ui/react`): `button`, `input`, `label`, `card`, `dialog`, `empty-state`, `pill`, `tabs`, `table`, `kpi`, `progress-bar`, `toast`. If a variant is not listed here, ask before adding it.

Buttons (`button.tsx`)

| Variant | Background | Text | Use |
| --- | --- | --- | --- |
| default | primary | primary-foreground | One per screen, the main action |
| secondary | secondary | secondary-foreground | Supporting actions |
| outline | background + border | foreground | Toolbar and filter actions |
| ghost | transparent | foreground | Low-emphasis actions, table rows |
| destructive | destructive/10 | destructive | Destructive actions, always confirm |
| link | transparent | primary | Inline navigation |
| ai | ai-soft | ai | Actions that run or accept an AI suggestion |

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

Data tables (`table.tsx`)
- Demo density: 13px cells, padding 2, 11px uppercase muted headers, 1px row dividers, no border on the last row. `numeric` on `TableHead`/`TableCell` right-aligns in mono `tabular-nums`. `data-selected` on a row gives the accent background. Wrapper scrolls horizontally.

Pills (`pill.tsx`)
- Tones: `neutral`, `success`, `accent`, `ai`, `warning`, `destructive`; `*-soft` background, matching text, radius-full, 11px. Status-to-tone mapping of the demo: `StatusPill` in `src/prototype/status-pill.tsx`.

Tabs (`tabs.tsx`, Base UI)
- 13px muted tabs on a bottom border; the active tab is foreground, semibold, with a 2px primary underline.

KPI tile (`kpi.tsx`)
- Card with an 11px uppercase label, a 30px Barlow Condensed value (`tabular-nums`) and an optional 12px muted detail.

Progress bar (`progress-bar.tsx`, Base UI Meter)
- 6px track in `muted`, fill in `primary`, `warning` or `destructive`. Always pass `aria-label`.

Toast (`toast.tsx`, Base UI)
- `toast(message)` from any client code. One at a time, bottom right, `foreground` background with `background` text, closes after 3.4 s.

## 07 Icons

- Set: Lucide (`lucide-react`). One set only.
- Sizes: 16px inline and in buttons (the Button default), 20px standalone.
- An icon is never the only label on an action. Add text or an `aria-label`.

## 08 Responsive breakpoints

| Name | Min width | Notes |
| --- | --- | --- |
| sm | 640px | Phones in landscape |
| md | 760px | Side rail appears (below: horizontal nav bar on top) |
| lg | 980px | 3- and 4-column grids appear (below: 1 and 2 columns) |
| xl | 1280px | Desktops |

Layout: 232px side rail, sticky, full height; content padding 28px inline (16px on mobile), grid gap 14px.

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
