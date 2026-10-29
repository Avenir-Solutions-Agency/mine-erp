import { XMLParser } from "fast-xml-parser";
import type { EkaerConfig } from "./config.ts";
import { passwordHash, requestSignature, xmlTimestamp } from "./sign.ts";

const NS = "http://schemas.nav.gov.hu/EKAER/1.0/ekaermanagement";
/** NAV's Management Service 2.2 XSD still tops the requestVersion enum at 2.1. */
const REQUEST_VERSION = "2.1";

export interface Location {
  name?: string;
  vatNumber?: string;
  country?: string;
  zipCode?: string;
  city?: string;
  street?: string;
  streetType?: string;
  streetNumber?: string;
}

export interface TradeCardItem {
  /** S sale (the only one allowed for D), W contract work, O other. */
  tradeReason: "S" | "W" | "O";
  /** 8-digit customs tariff number. */
  productVtsz: string;
  productName: string;
  weightKg: number;
  /** Whole forints; convert from fillér before calling. */
  valueHuf: number;
}

export interface Party {
  name: string;
  vatNumber: string;
  country: string;
  address: string;
}

export interface TradeCard {
  orderNumber?: string;
  tradeType: "D" | "I" | "E";
  modByCarrierEnabled: boolean;
  seller: Party;
  destination: Party;
  vehicle?: { plateNumber: string; country: string };
  deliveryPlans: {
    loadLocation: Location;
    unloadLocation: Location;
    items: TradeCardItem[];
  }[];
}

/** shortcut: modify and correction (with itemOperation) come with T-014, when the workflow needs them. */
export type Operation =
  | { operation: "create"; tradeCard: TradeCard }
  | { operation: "finalize"; tcn: string; arrivalDate: Date }
  | { operation: "delete"; tcn: string; reason: string };

export interface QueryParams {
  insertFromDate: Date;
  insertToDate: Date;
  orderNumber?: string;
  plateNumber?: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** One element per present value, in the order given; XSD 2.x rejects any other order. */
const el = (
  name: string,
  value: string | number | boolean | undefined | null,
) =>
  value == null || value === ""
    ? ""
    : `<${name}>${esc(String(value))}</${name}>`;
const block = (name: string, inner: string) =>
  inner ? `<${name}>${inner}</${name}>` : "";

function wholeNumber(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999)
    throw new Error(`${what} must be a whole number of at most 9 digits`);
  return n;
}

const location = (l: Location) =>
  el("name", l.name) +
  el("VATNumber", l.vatNumber) +
  el("country", l.country) +
  el("zipCode", l.zipCode) +
  el("city", l.city) +
  el("street", l.street) +
  el("streetType", l.streetType) +
  el("streetNumber", l.streetNumber);

const item = (i: TradeCardItem) =>
  block(
    "tradeCardItem",
    el("tradeReason", i.tradeReason) +
      el("productVtsz", i.productVtsz) +
      el("productName", i.productName) +
      el("weight", wholeNumber(i.weightKg, "weight")) +
      el("value", wholeNumber(i.valueHuf, "value")),
  );

const tradeCard = (t: TradeCard) =>
  block(
    "tradeCard",
    el("orderNumber", t.orderNumber) +
      el("tradeType", t.tradeType) +
      el("modByCarrierEnabled", t.modByCarrierEnabled) +
      el("sellerName", t.seller.name) +
      el("sellerVatNumber", t.seller.vatNumber) +
      el("sellerCountry", t.seller.country) +
      el("sellerAddress", t.seller.address) +
      el("destinationName", t.destination.name) +
      el("destinationVatNumber", t.destination.vatNumber) +
      el("destinationCountry", t.destination.country) +
      el("destinationAddress", t.destination.address) +
      (t.vehicle
        ? block(
            "vehicle",
            el("plateNumber", t.vehicle.plateNumber) +
              el("country", t.vehicle.country),
          )
        : "") +
      block(
        "deliveryPlans",
        t.deliveryPlans
          .map((p) =>
            block(
              "deliveryPlan",
              block("items", p.items.map(item).join("")) +
                block("loadLocation", location(p.loadLocation)) +
                block("unloadLocation", location(p.unloadLocation)),
            ),
          )
          .join(""),
      ),
  );

const operation = (op: Operation, index: number) =>
  block(
    "tradeCardOperation",
    el("index", index) +
      el("operation", op.operation) +
      (op.operation === "create"
        ? tradeCard(op.tradeCard)
        : op.operation === "finalize"
          ? el("tcn", op.tcn) + el("arrivalDate", xmlTimestamp(op.arrivalDate))
          : el("tcn", op.tcn) + el("statusChangeModReasonText", op.reason)),
  );

function envelope(
  root: string,
  body: string,
  cfg: EkaerConfig,
  requestId: string,
  at: Date,
) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<${root} xmlns="${NS}">` +
    block(
      "header",
      el("requestId", requestId) +
        el("timestamp", xmlTimestamp(at)) +
        el("requestVersion", REQUEST_VERSION) +
        el("headerVersion", "1.0"),
    ) +
    block(
      "user",
      el("user", cfg.user) +
        el("passwordHash", passwordHash(cfg.password)) +
        el("VATNumber", cfg.vatNumber) +
        el("requestSignature", requestSignature(requestId, at, cfg.signingKey)),
    ) +
    body +
    `</${root}>`
  );
}

export function manageTradeCardsXml(
  ops: Operation[],
  cfg: EkaerConfig,
  requestId: string,
  at: Date,
) {
  return envelope(
    "manageTradeCardsRequest",
    block(
      "tradeCardOperations",
      ops.map((op, i) => operation(op, i + 1)).join(""),
    ),
    cfg,
    requestId,
    at,
  );
}

export function queryTradeCardsXml(
  query: { tcn: string } | QueryParams,
  cfg: EkaerConfig,
  requestId: string,
  at: Date,
) {
  const body =
    "tcn" in query
      ? el("tcn", query.tcn)
      : block(
          "queryParams",
          el("insertFromDate", xmlTimestamp(query.insertFromDate)) +
            el("insertToDate", xmlTimestamp(query.insertToDate)) +
            el("orderNumber", query.orderNumber) +
            el("plateNumber", query.plateNumber),
        );
  return envelope("queryTradeCardsRequest", body, cfg, requestId, at);
}

/** Credentials-free copy of a request, safe to store as evidence. */
export const maskRequest = (xml: string) =>
  xml.replace(/<(passwordHash|requestSignature)>[^<]*</g, "<$1>***<");

// ---- responses

export type FuncCode = "OK" | "WARNING" | "ERROR";

export interface OperationResult {
  index: number;
  operation: string;
  funcCode: FuncCode;
  reasonCode: string;
  msg: string | null;
  tcn: string | null;
  status: string | null;
  warnings: string[];
}

export interface TradeCardInfo {
  tcn: string;
  orderNumber: string | null;
  status: string | null;
  plateNumber: string | null;
}

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: true,
  isArray: (name) =>
    [
      "operationResult",
      "tradeCardInfo",
      "warning",
      "tradeCardItem",
      "deliveryPlan",
    ].includes(name),
});

type Node = Record<string, unknown>;
const str = (v: unknown) => (v == null || v === "" ? null : String(v));

/** The response root and its top-level result, whatever the namespace prefix. */
export function parseResponse(
  xml: string,
  root: string,
): { root: Node; funcCode: FuncCode; reasonCode: string; msg: string | null } {
  const doc = parser.parse(xml) as Node;
  const r = doc[root] as Node | undefined;
  if (!r) throw new Error(`EKÁER response has no ${root}`);
  const result = (r.result ?? {}) as Node;
  return {
    root: r,
    funcCode: String(result.funcCode) as FuncCode,
    reasonCode: String(result.reasonCode),
    msg: str(result.msg),
  };
}

export function operationResults(r: Node): OperationResult[] {
  const list = ((r.tradeCardOperationsResults as Node | undefined)
    ?.operationResult ?? []) as Node[];
  return list.map((o) => {
    const res = (o.result ?? {}) as Node;
    // tradeCardInfo is parsed as a list (it is one in query responses); an operation has at most one.
    const info = ((o.tradeCardInfo as Node[] | undefined)?.[0] ?? {}) as Node;
    const warnings = ((o.warnings as Node | undefined)?.warning ??
      []) as unknown[];
    return {
      index: Number(res.index),
      operation: String(res.operation),
      funcCode: String(res.funcCode) as FuncCode,
      reasonCode: String(res.reasonCode),
      msg: str(res.msg),
      tcn: str(info.tcn),
      status: str(info.status),
      warnings: warnings.map(String),
    };
  });
}

export function tradeCardInfos(r: Node): TradeCardInfo[] {
  const list = ((r.tradeCards as Node | undefined)?.tradeCardInfo ??
    []) as Node[];
  return list.map((t) => ({
    tcn: String(t.tcn),
    orderNumber: str(t.orderNumber),
    status: str(t.status),
    plateNumber: str((t.vehicle as Node | undefined)?.plateNumber),
  }));
}
