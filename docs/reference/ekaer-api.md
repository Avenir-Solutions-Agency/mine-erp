# EKÁER Management Service 2.2: interface summary

Summary of NAV's machine-to-machine XML interface for EKÁER reports (trade cards).
Source: [eKAERManagementService_2.2.pdf](https://ekaer.nav.gov.hu/faq/content/uploads/2025/05/eKAERManagementService_2.2.pdf) (65 pages, read 2026-10-26).
The PDF is the authority; this file only picks out what the ERP needs. Field names and codes are kept as NAV writes them.

Not covered here: the full field tables, the complete `reasonCode` list and the XSDs (`ekaermanagement.xsd`, `common.xsd`; on the eKÁER FAQ page), and the legal thresholds that decide when a report is required.

## 1. Purpose

- Three channels: the web UI, uploading an XML file on the web, and the machine-to-machine service. The last two use the same XML.
- A report created on the web starts in `P` (planning) without an eKÁER number. A report created through XML is active (`S`) at once: it gets its eKÁER number (`tcn`) and the security deposit is calculated immediately.
- On a web upload the changes are made in the name of the user in the XML `user` block, not the logged-in person.

## 2. Message structure

Four message types: `manageTradeCardsRequest`/`Response` (create, modify, delete, finalize, correction) and `queryTradeCardsRequest`/`Response`.

Every message has a `header` and a `user` block.

### header

| Field | Rule |
| --- | --- |
| `requestId` | Max 50 chars. Unique per user; a reused id is rejected. |
| `timestamp` | `xs:dateTime`. Not older than 24 h, not in the future; 5 min tolerance against server time. Always send a time zone. |
| `requestVersion` | Required since 2.0 (enum `1.0` … `2.2`). |
| `headerVersion` | Optional, default `1.0`. |

### user

| Field | Rule |
| --- | --- |
| `user` | Login name, max 30 chars. |
| `passwordHash` | SHA-512 of the password, never the plain password. |
| `VATNumber` | First 8 digits of the taxpayer's Hungarian tax number. |
| `requestSignature` | See below. |

### requestSignature

```
SHA-512( requestId + timestamp as UTC "yyyyMMddHHmmss" + XML signing key )
```

- The signing key ("XML kommunikációs kulcs") is a 6–15 character secret the user sets on the web. Without it the XML interface cannot be used.
- The timestamp in the hash is always the UTC equivalent of the `timestamp` sent. A timestamp without a time zone is read in the server's zone, which breaks the signature.
- Example from the PDF: `TSTKFT1222564` + `20150115122545` + `Elek65Titkos` → `AF84DC45…AFB889`.

## 3. Operations (`manageTradeCards`)

A request carries a list of `tradeCardOperation` items, each with an `index` and an `operation`.

| Operation | Carries | Notes |
| --- | --- | --- |
| `create` | `tradeCard` | No `tcn`, no item or delivery plan `id`. |
| `modify` | `tradeCard` | Active reports only. Since 1.9 every item needs `itemOperation` (`create`/`modify`/`delete`); unchanged items are `modify`; deleted items must still be listed; adding or deleting an item needs a reason. |
| `delete` | `tcn` + `statusChangeModReasonText` | Active reports only (`S` → `I`). |
| `finalize` | `tcn` + `arrivalDate`/`arrivalDateOnly` | Since 2.0 the unloading date is given only here. |
| `correction` | `tradeCard` | Since 2.0, after closing, not for export. Plate number, item weight, item value only. Each correction incurs a surcharge (`allowance`) the taxpayer must pay; allowed within a legal number of working days and times. |

Modifiable on an active report:

- Header: `orderNumber`, `plateNumber` + `country`, `modByCarrierEnabled`, `carrier`, `carrierText`; `loadDate` if not given at creation.
- Items: `value`, `weight`, `productVtsz`, `productName`.

## 4. The report (`tradeCard`)

- `tradeType`: `D` domestic → domestic, `I` EU → Hungary, `E` Hungary → EU.
- Seller and recipient tax number and name are required in every direction; for `D` their addresses too.
- `deliveryPlans`: each delivery plan holds one load and one unload address and any number of items. A normal report needs at least one.
- Load and unload addresses are required for `E` and `D`. Hungarian zip code + town must match NAV's zip master data, otherwise `TC_WRONG_ZIP_CITY_WARN` (only the part before the first space or bracket is checked).
- Items:
  - `productVtsz`: 8 digits; it decides risky product, FELIR, dangerous goods and food checks.
  - `weight` in kg and `value` in HUF: integers, max 9 digits, value > 0.
  - `tradeReason`: `S` sale/purchase (deposit calculated), `W` contract work, `O` other. For `D` only `S` is allowed.
  - `vatRateAssuranceExemption` (2.1+): declares exemption from the deposit for 5 % VAT products; rejected with `TCI_INVALID_ASSURANCE_STATEMENT` where the VTSZ does not allow it.
- Dates: `loadDate`/`loadDateOnly` only for export; `arrivalDate`/`arrivalDateOnly` only for import and domestic, and only in `finalize`. A 2.0+ request that sends both is not processed. Setting `arrivalDate` on create or modify gives `TC_ARRIVALDATE_TIME_ERROR`.
- Before closing, `vehicle` must hold a real plate number and the unloading date must be known.

## 5. Response and statuses

Each operation gets an `operationResult`:

- `result`: `funcCode` (`OK`, `WARNING`, `ERROR`), `reasonCode` (`SUCCESS` or an error code), `msg`, plus `index` and `operation` copied from the request.
- `tradeCardInfo`: the report's state after the operation, including `tcn`.
- `NAVValidations` (2.0+): unusual values, e.g. low or high total value or weight, wrong zip–town pairs.
- `warnings`, and an `allowance` list for correction surcharges.

Statuses:

| Code | Meaning |
| --- | --- |
| `P` | Planning; only for reports created on the web. |
| `S` | Active, has an eKÁER number, deposit calculated. |
| `F` | Finalized: unloading reported, or the 15-day life ended. |
| `I` | Inactive: an `S` report deleted; its deposit is released. |
| `D` | Deleted: a `P` report deleted. |

Security deposit: calculated for risky products in `I` and `D` transports over a 45-day sliding window. A new item or a value increase without enough deposit cover is rejected.

## 6. Query (`queryTradeCards`)

- Either one `tcn`, or `queryParams`: `insertFromDate` and `insertToDate` (required, max 30 days apart), `orderNumber`, `tradeType`, `status`, `plateNumber`, `sellerVatNumber`, `destinationVatNumber`, `maxRowNum` (1–1000, default 1000).
- Returns only `S`, `F` and `I` reports. A result of exactly 1000 rows means the range should be narrowed.

## 7. Transport

- HTTP POST with headers `content-type: text/xml` and `accept: text/xml`; the body is the XML.
- Business errors come back as HTTP 200 with the code in `result.reasonCode`.
- Exception (2.2): an expired password gives HTTP 400 `EXPIRED_PASSWORD`, already from midnight of the expiry day.
- Since 2.0 XSD validation is strict: wrong element order or namespace is an error.

### Endpoints

Test (the only one the ERP may call; AGENTS.md §03):

- `https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer/manageTradeCards`
- `https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer/queryTradeCards`
- `https://import-test.ekaer.nav.gov.hu/TradeCardManagementService/customer/validateTradeCardRequest`: XSD and validation only, no business effect; takes a `manageTradeCardsRequest`.

Production is `import.ekaer.nav.gov.hu` with the same paths. Never call it from code, tests or scripts.

## 8. What this means for the ERP

- The password hash and the signing key are secrets: secret store only, server side only (docs/SECURITY.md).
- Store each `requestId` with the request and response XML (without credentials) as evidence. NAV rejects a reused `requestId`, so after a lost response check the outcome with `queryTradeCards` (by `orderNumber`) before sending again with a new id; otherwise a retry can create a duplicate report.
- Flow: `create` from the registered shipment, then `finalize` with `arrivalDate` when unloading is confirmed. `modify`, `delete` and `correction` need human approval (docs/SECURITY.md).
- Weight goes out as integer kg; value is rounded from fillér to integer HUF at the integration edge.
- Start development against `validateTradeCardRequest` on the test system.
