# Demo inventory

Functional inventory of the claude.ai demo page (`docs/reference/demo.html`, 2043 lines, single-file vanilla JS, in-memory state `S`). It is the source for the 1:1 port: every screen, control, rule, constant and Hungarian UI string. Line numbers point into `docs/reference/demo.html`.

The demo patches itself: later code wraps or replaces earlier views, handlers and `NAV`. The final behavior is the last definition; each part notes where a wrap happens.

## Files

| File | Source lines | Covers |
| --- | --- | --- |
| [01-design-state-domain.md](01-design-state-domain.md) | 1–470 | Design tokens and component classes, breakpoints, `NAV` and routing, the full state model (`S`, `SEQ`, ID formats, status enums, policy thresholds), core domain functions (cost model, price engine, inquiry parsing, approvals, integration outbox, EKÁER, Billingo, stock, seed) |
| [02-core-screens.md](02-core-screens.md) | 470–900 | Charts, 13-week cash flow, every core view (dash, inbox, quotes, orders, transport, billing, stock, store, machines, reports, ai, integr, plan), detail panels, shared click/change handlers, `decide()` |
| [03-rules-dispatch-contracts.md](03-rules-dispatch-contracts.md) | 900–1400 | What-if simulation, customer profitability, plan vs actual, production shifts and recipes, lab quality hold, fleet and drivers, address rules, driving and rest limits, dispatch suggestion and auto-assignment, dispatcher screen, document registry (SHA-256), contracts, TIG, customer portal, driver app |
| [04-apps-devices-bootstrap.md](04-apps-devices-bootstrap.md) | 1400–2043 | Proof of delivery, telematics map, delivery notes, inbound and outbound invoices, payroll and CSV export, QR warehouse, EKÁER admin gate, operator and mechanic apps, ANPR weighbridge, waste landfill, RFID refuelling, PDF/XLSX order intake, capacity plan, material balance, "Ma" summary, timeline drag, global event delegation, bootstrap |

## Final navigation (after all patches)

| Group | Routes (id: label, badge) |
| --- | --- |
| Áttekintés | `dash`: Tulajdonosi irányítópult · `today`: Ma (mobil) · `ai`: Jóváhagyások és AI (ap) |
| Értékesítés | `inbox`: Ajánlatkérések (inq) · `quotes`: Árajánlatok · `contracts`: Szerződések (con) · `orders`: Megrendelések · `portal`: Vevői portál |
| Logisztika | `dispatch`: Fuvarszervezés (pend) · `transport`: Fuvarok és EKÁER (ek) · `scale`: Mérleg (rendszámfelismerés) · `driverapp`: Sofőr app · `telem`: Telematika (iTrack) · `dn`: Szállítólevelek · `tig`: Teljesítésigazolás (tig) · `billing`: Számlák · `integr`: Integrációk (jobs) |
| Üzem | `stock`: Termékkészlet · `store`: Üzemi raktár · `qr`: QR raktár · `operapp`: Gépkezelő app · `mechapp`: Szerelő app (mlog) · `waste`: Hulladéklerakó · `machines`: Gépek |
| Pénzügy | `reports`: Riportok és árazás · `payroll`: Bérszámfejtés |
| Projekt | `plan`: Rendszerterv |

Active route is kept in `localStorage['mperp-route']`. Badge formulas are in part 4, "Navigation, counts".

## Runtime dependencies the port must replace

| Demo | What it does | Port note |
| --- | --- | --- |
| `window.claude.use('sample')` → `SAMPLE` | "Kérdezze az ERP-t", inquiry re-parse with Claude, "Ma" summary | Server-side endpoint only; output validated with Zod (AGENTS.md §04–05) |
| `window.claude.use('downloads')` | CSV export (payroll, fuel card) with UTF-8 BOM | Normal browser download |
| qrious 4.0.2, jsQR 1.4.0 | QR label generation, camera scan | New dependencies: need approval |
| pdf.js 2.16.105, SheetJS 0.18.5 | PDF/XLSX order intake | New dependencies: need approval |
| In-memory `S` + `seed()` | All data | Prototype: seed module; later Postgres + Drizzle |
| Simulated NAV EKÁER, Billingo, iTrack, ANPR, RFID, bank | Integrations | Prototype stays simulated; never call EKÁER production (AGENTS.md §03) |

## Design tokens vs docs/DESIGN_SYSTEM.md

| Aspect | Demo | DESIGN_SYSTEM.md today |
| --- | --- | --- |
| Primary colour | quarry green `#1E6B58` (dark `#5DC1A3`), amber `--ai`, limestone-grey base | neutral shadcn placeholder "until the brand colour arrives" |
| Fonts | Barlow Condensed (display), IBM Plex Sans (body), IBM Plex Mono | Geist Sans, Geist Mono; max two families per page |
| Radius | `--r` 6px; pills 10px | `--radius` 10px scale |
| Dark mode | supported (`prefers-color-scheme` + `data-theme`) | not supported in v1 |
| Status colours | ok / acc / ai / warn / bad pills | success / warning / destructive |
| Layout | 232px left rail, sticky; 980px and 760px breakpoints | see DESIGN_SYSTEM §08 |

Decided 2026-10-26: the demo wins. DESIGN_SYSTEM.md now holds the demo tokens.

## Known quirks in the demo (recorded, not fixed)

- Seeded hibajegy points to `GN-0006`, its log entry is `GN-0005`.
- October payroll CSV writes 0 into the base-pay column (case-sensitive regex).
- `Szinkron most` (`itsync`) and `tsel` have no handler.
- "Kompatibilis gépek" column has a header but no body cells.
- Mechanic app `Fotó` input has no handler.
- `X.inok` has no visible button after the inbound tab override.
- Waste intake: the final `Rögzítve.` toast hides the contract-mismatch toast.
