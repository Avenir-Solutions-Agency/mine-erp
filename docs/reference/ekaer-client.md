# EKÁER client (`packages/ekaer`): design

How the ERP talks to NAV EKÁER. Implements T-013; the workflow on top of it is T-014.
The interface itself (fields, codes, statuses) is in [ekaer-api.md](ekaer-api.md), summarised from NAV's Management Service 2.2 PDF. This file only covers how we build the client.

Reference implementation: [EKAER-Dotnet-Client](https://github.com/fossabot/EKAER-Dotnet-Client) (MIT, .NET, last change 2020). We take its signing logic and local validation rules, not its code: it targets `requestVersion` 1.9, has no tests, and returns `null` on some failures.

## 1. Scope

The client does one thing: turn typed operations into signed 2.2 XML, send it, and return the typed result together with the raw XML.

The client does not:

- retry (Temporal does; see §6),
- decide whether a report is required (domain rule in `packages/domain`),
- store anything (the workflow stores the evidence),
- ask for human approval (policy engine and workflow).

## 2. Credentials

| Variable            | What it is                                                                                                     | Where it comes from                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `EKAER_BASE_URL`    | Service base URL, required, no default (decided 2026-10-29); the production host is refused outside production | Deployment config                                        |
| `EKAER_USER`        | Login name of a secondary EKÁER user, 6–30 chars of letters, digits, `-`, `@`, `.`                             | Created by the company's EKÁER admin on ekaer.nav.gov.hu |
| `EKAER_PASSWORD`    | That user's password; only its SHA-512 hash is sent                                                            | Same                                                     |
| `EKAER_SIGNING_KEY` | "XML kommunikációs kulcs", 6–15 chars, set by the user on the web                                              | Same                                                     |
| `EKAER_TAX_NUMBER`  | First 8 digits of the company's tax number                                                                     | Company data                                             |

EKÁER has no OAuth: no client id, client secret or token. Only `apps/worker` reads these, from the secret store (docs/SECURITY.md).

## 3. Environment guard

The production host differs from the test host only by name, and the same credentials may work on both. One wrong config value would file a legally binding report, so:

- `EKAER_BASE_URL` has no default: a missing value stops the client instead of falling back to a host (option 1, decided 2026-10-29).
- The production host `import.ekaer.nav.gov.hu` is accepted only when `NODE_ENV === "production"`; plain `http` is refused.
- Unit tests cover the missing URL, the production host outside production and `http`.

## 4. Module layout

```
packages/ekaer/src/
  config.ts      read and validate env (Zod), resolve host, apply the guard
  sign.ts        passwordHash(), requestSignature()
  xml.ts         build manageTradeCardsRequest / queryTradeCardsRequest, parse responses
  client.ts      createEkaerClient(): manageTradeCards, queryTradeCards, validateTradeCardRequest
  errors.ts      EkaerTransportError, EkaerOutcomeUnknownError, EkaerExpiredPasswordError
  index.ts
packages/ekaer/fixtures/   sample response XMLs for the mock server and parser tests
packages/ekaer/xsd/        common.xsd, ekaermanagement.xsd (2.2, from the eKÁER FAQ page)
```

Operation and trade card types come from `packages/contracts` (Zod), not from this package.

## 5. Request building

Every request gets:

- `header`: `requestId` = UUIDv7 without dashes (32 chars, under the 50-char limit, unique per user); `timestamp` = current UTC time with `Z`; `requestVersion` = `2.1` (the 2.2 XSD's highest value); `headerVersion` = `1.0`.
- `user`: `user`, `passwordHash`, `VATNumber`, `requestSignature`.

Signing (uppercase hex, as in the NAV example and the .NET client):

```
passwordHash     = SHA512(password)
requestSignature = SHA512(requestId + utc(timestamp, "yyyyMMddHHmmss") + signingKey)
```

The hash input must use the same instant as the `timestamp` element. Build both from one `Date`.

Test vector from the NAV PDF (must be a unit test):

```
requestId  TSTKFT1222564
timestamp  2015-01-15T12:25:45Z  → 20150115122545
signingKey Elek65Titkos
signature  AF84DC456B82234E67550C80169E517FBDAB4403607293985DECB09F534D9F73FADAABEFEE932554FABBC49F6E8F74A5DD54EA359D6B7644D95CFF3530AFB889
```

Before sending, the XML is validated against the 2.2 XSDs. Since 2.0, NAV rejects wrong element order or namespaces, so we catch these locally instead.

Value conversions happen here, at the edge: weight stays integer kg, and value is rounded from fillér to integer HUF.

## 6. Results and errors

Each call returns `{ requestId, requestXml, responseXml, result }`. `requestXml` has `passwordHash` and `requestSignature` masked, so the caller can store it as evidence as is.

| Situation                              | What the client does                                                   |
| -------------------------------------- | ---------------------------------------------------------------------- |
| HTTP 200, `funcCode` `OK` / `WARNING`  | Return the parsed result, warnings and `NAVValidations` included       |
| HTTP 200, `funcCode` `ERROR`           | Return the parsed result; the business error is data, not an exception |
| HTTP 400 `EXPIRED_PASSWORD`            | Throw `EkaerExpiredPasswordError` (needs a person; no retry)           |
| Local XSD failure                      | Throw before sending; nothing reached NAV                              |
| Connection refused before sending      | Throw `EkaerTransportError`; safe to retry                             |
| Timeout or lost response after sending | Throw `EkaerOutcomeUnknownError`; the report may exist                 |

`EkaerOutcomeUnknownError` is the one that matters. The workflow must then run `queryTradeCards` by `orderNumber` and only resend, with a new `requestId`, if nothing was created (ARCHITECTURE.md §06, T-014). A blind retry can file a duplicate report.

## 7. Local validation

The .NET client's `LocalValidate` checks are worth keeping as Zod refinements in `packages/contracts`:

- Hungarian tax numbers are 8 digits; seller and recipient name required.
- `D` and `E`: seller country and address required. `D` and `I`: recipient country and address required.
- `I`: seller country is not `HU`. `E`: seller country is `HU`.
- `modByCarrierEnabled` requires `carrier`.
- Items: `productName` required, `productVtsz` 8 digits, `weight` ≥ 0, `value` > 0 (2.2 requires positive).

Plus the 2.x rules the .NET client predates: no `arrivalDate` on create or modify, `loadDate` only for export, `tradeReason` `S` only for `D`, and `itemOperation` on every item in `modify`.

## 8. Testing

| Level                                | Runs where          | Covers                                                                                                          |
| ------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit                                 | CI                  | Signature test vector, XML builder output against the XSD, response parsing from `fixtures/`, environment guard |
| Mock NAV server                      | CI                  | Every row of §6, duplicate `requestId`, query-before-resend in the workflow                                     |
| NAV test, `validateTradeCardRequest` | Manually or nightly | Real XSD and business validation, no report created                                                             |
| NAV test, `manageTradeCards`         | E2E (T-021)         | Create → query → finalize, delete with reason, real test `tcn`                                                  |

The NAV test levels need a secondary EKÁER user (§2). Never call the production host from a test.

## 9. Open points

- Dependencies need approval (AGENTS.md §03): an XML builder/parser (e.g. `fast-xml-parser`) and an XSD validator (e.g. `xmllint-wasm`). `fetch` and `node:crypto` are built in.
- Answered 2026-10-29: NAV's test system does not accept the production user. The company's production login works on ekaer.nav.gov.hu, but `pnpm --filter @mine-erp/ekaer check` against `import-test` returns `INVALID_USER_OR_PASSWORD`. A separate test-system user is needed; ask the EKÁER help desk how to get one.
