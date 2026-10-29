# PORTAL AI (Netto Scales): scale software interface summary

Not used: decided 2026-10-29, the new ERP does the weighing itself (PRD §08). Kept as a reference for what a weighing program handles: two-stage weighing, gross/tare roles, stability, void instead of delete, stock from movements, the weighing record's fields.
Sources, received 2026-10-29 and kept next to this file (the PDFs are the authority; this file picks out what the ERP needs):

- [`portal-ai/erp-api-1.2-hu.pdf`](portal-ai/erp-api-1.2-hu.pdf): ERP API developer reference, API 1.2, released 2026-09-05, needs program version 2026 fix2149 or later.
- [`portal-ai/database-fields-hu.pdf`](portal-ai/database-fields-hu.pdf): SQLite database access and field reference, released 2026-09-04.

## 1. Two ways in, use the API

| Route | Use |
| --- | --- |
| ERP API, `http://<scale-pc>:8000/api/v1` (FastAPI, JSON) | The supported route. Reads weighings, master data, warehouses and stock; optional write mode. |
| SQLite file `%LOCALAPPDATA%\HidmerlegPortaprogram\portal.db` | Read-only fallback, filesystem permission only, no DB password. Never write to it; never read `config.secrets.enc`. |

The weight is always recorded by PORTAL AI itself (scale signal, stability, signature, EKÁER, documents). The ERP never sends a weight.

## 2. Connection and auth

- `Authorization: Bearer portal_erp_<key>` on every call. The key is generated in the program (Program > ERP API kapcsolat), shown once, stored there only as SHA-256. It goes to our secret store (`PORTAL_API_KEY`, not yet in `.env.example`); never in a URL, log or the repo.
- Built-in LAN access is plain HTTP on 8000/TCP. Vendor advice: separate VLAN, firewall to the ERP host only, fixed IP; across sites only through VPN or a TLS reverse proxy. For us this means the local scale agent (or a VPN) sits between the hosted ERP and the scale PC.
- Switches in the program: ERP API on/off, write commands (POST/PUT/DELETE) on/off, LAN access (restart needed). Check `GET /health` (`mode: read_only | read_write`) and `GET /capabilities` at start; never assume write or automation is enabled.

## 3. Conventions

- Success: `{ "ok": true, ... }`. App error: `{ "ok": false, "error": { "code", "message" } }`; FastAPI validation can also return 422 with a `detail` list. Handle both.
- Weights in kg (`REAL` in the DB: round to integer kg at our boundary). Sync timestamps ISO 8601 with a zone (`2026-09-04T08:00:00Z`); stored measurement times may be local-format text.
- Writes: send `Idempotency-Key` (same key + same body replays the stored answer with `Idempotent-Replayed: true`; same key + different body is 409). `X-Request-ID` optional; write responses carry `request_id` for their audit log.
- Retry 500/503 and network errors with exponential backoff (same idempotency key on writes). Fix the request on 400/401/403/404/409/422.

## 4. Endpoints the ERP needs first

| Method | Path | For |
| --- | --- | --- |
| GET | `/health`, `/capabilities` | Startup checks, monitoring. |
| GET | `/weighings?status=completed&updated_since=…&limit=500` | Shipment sync (F1/F4). Cursor paging: pass `page.next_cursor` unchanged with the same filters while `page.has_more`. |
| GET | `/weighings/{id}` | One full record. |
| GET | `/weighings/{id}/documents/{ticket\|delivery-note\|invoice}` | Certified PDF (binary on 200; 404/409/500 depending on state). |
| GET | `/master-data/{category}` | `customer`, `seller`, `carrier`, `driver`, `material`, `plate`, `unloading_place`, `warehouse_location`. |
| GET | `/warehouses`, `/warehouse/stock`, `/warehouse/movements` | Stock (phase 3). |
| POST/PUT/DELETE | `/master-data/…`, `/jobs`, `PUT /warehouse/opening` | Write mode only. Not in v1. |

Other filters on `/weighings`: `license_plate` (normalised exact), `ticket_number` (exact), `customer`, `material` (partial), `date_from`/`date_to` (YYYY-MM-DD), `include_archived`.

## 5. Sync rules (vendor-recommended, adopt as is)

- Upsert by PORTAL `id`, idempotent. `updated_since` is inclusive: overlap the next run a little and expect repeats.
- Never reuse a cursor with other filters; a new filter set starts a new loop.
- Cancellation arrives as `status=void`; PORTAL never deletes a weighing. The ERP must handle void and must not delete its own earlier record.
- Alert an operator on 401/403/409/422 and log the `request_id`.

## 6. Weighing record (fields we map)

| PORTAL field | Meaning | ERP use |
| --- | --- | --- |
| `id`, `ticket_number`, `status` (`open`/`completed`/`void`), `direction` (`inbound`/`outbound`) | identity and state | document + shipment link; unique ticket number + year |
| `license_plate`, `trailer_plate` | tractor and trailer plate | `vehicle.plate` (normalise) |
| `customer_name`, `customer_tax_number`, `customer_address`, EU tax no. | customer | `customer` match (review if unknown) |
| `seller_name` … | stock owner / our company (three firms share the scale) | owner company |
| `material_name`, `ekaer_vtsz` | product and VTSZ | product + EKÁER obligation |
| `gross`, `tare`, `net`, `clean_net`, `first/second_weight(_role)` | kg | net = gross − tare check; `clean_net` after quality deduction |
| `driver_name`, `carrier_name`, `unloading_place`, `loading_warehouse_id/name` | transport | shipment |
| `ekaer_number`, `ekaer_status`, `ekaer_last_error`, load/unload location and country, `ekaer_trade_type` | PORTAL's own EKÁER data | **Open question:** PORTAL can file EKÁER itself; decide who files so no shipment is reported twice (ARCHITECTURE §06 query-before-resend). |
| `unit_price`, `vat_rate`, `net_value`, `vat_amount`, `gross_value`, `currency` | price | later (phase 2) |
| `completed_at`, `created_at`, `first/second_measured_at` | times | convert to UTC at the boundary |

Stock (phase 3): current = opening + signed completed movements (inbound +, outbound −, `clean_net` if > 0 else `net`), in kg.
