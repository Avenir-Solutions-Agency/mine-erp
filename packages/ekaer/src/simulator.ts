import { randomInt } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// A stand-in for NAV's EKÁER service, used with EKAER_SIMULATE=true until a test-system user
// exists, and in tests. It remembers reports by orderNumber with NAV-style ids, so
// query-before-resend, modify and finalize behave like the real service.

const NS = "http://schemas.nav.gov.hu/EKAER/1.0/ekaermanagement";
const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (n) =>
    ["tradeCardOperation", "deliveryPlan", "tradeCardItem"].includes(n),
});

type Node = Record<string, unknown>;
interface Card {
  tcn: string;
  orderNumber: string;
  status: "S" | "I" | "F";
  planId: string;
  items: { id: string; weight: string }[];
}

let nextId = 1000;
const header = (requestId: string) =>
  `<header><requestId>${requestId}</requestId><timestamp>${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</timestamp><requestVersion>2.1</requestVersion></header><result><funcCode>OK</funcCode><reasonCode>SUCCESS</reasonCode></result>`;
const info = (c: Card) =>
  `<tradeCardInfo><tcn>${c.tcn}</tcn><orderNumber>${c.orderNumber}</orderNumber><tradeType>D</tradeType>` +
  `<deliveryPlans><deliveryPlan id="${c.planId}"><items>` +
  c.items
    .map(
      (i) =>
        `<tradeCardItem id="${i.id}"><weight>${i.weight}</weight></tradeCardItem>`,
    )
    .join("") +
  `</items></deliveryPlan></deliveryPlans><status>${c.status}</status></tradeCardInfo>`;
const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
const plans = (card: Node) =>
  ((card.deliveryPlans as Node | undefined)?.deliveryPlan ?? []) as Node[];
const items = (plan: Node) =>
  ((plan.items as Node | undefined)?.tradeCardItem ?? []) as Node[];

export function simulatedNav() {
  const cards = new Map<string, Card>();
  const byTcn = (tcn: unknown) =>
    [...cards.values()].find((c) => c.tcn === String(tcn));

  /** Applies one operation; returns the card, or the NAV error code. */
  function apply(op: Node, commit: boolean): Card | string {
    const kind = String(op.operation);
    if (kind === "create") {
      const card = op.tradeCard as Node;
      const c: Card = {
        tcn: `E${String(randomInt(1e12)).padStart(12, "0")}SI`,
        orderNumber: String(card.orderNumber ?? ""),
        status: "S",
        planId: String(nextId++),
        items: plans(card)
          .flatMap(items)
          .map((i) => ({ id: String(nextId++), weight: String(i.weight) })),
      };
      if (commit) cards.set(c.orderNumber, c);
      return c;
    }
    const card = op.tradeCard as Node | undefined;
    const c = byTcn(card?.tcn ?? op.tcn);
    if (!c) return "TC_NOT_FOUND";
    if (c.status !== "S") return "TC_STATUS_ERROR";
    if (kind === "modify") {
      const sent = plans(card!).flatMap(items);
      if (
        sent.some(
          (i) => !i.itemOperation || !c.items.some((x) => x.id === i["@_id"]),
        )
      )
        return "TCI_ITEM_OPERATION_MISSING";
      const changed = sent.filter(
        (i) =>
          c.items.find((x) => x.id === i["@_id"])!.weight !== String(i.weight),
      );
      if (changed.some((i) => !i.weightModReasonText))
        return "TC_MOD_REASON_MISSING";
      if (commit)
        for (const i of sent)
          c.items.find((x) => x.id === i["@_id"])!.weight = String(i.weight);
    }
    if (commit && kind === "delete") c.status = "I";
    if (commit && kind === "finalize") c.status = "F";
    return c;
  }

  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).split("/").pop();
    const doc = parser.parse(String(init?.body)) as Node;
    if (path === "queryTradeCards") {
      const q = doc.queryTradeCardsRequest as Node;
      const order = (q.queryParams as Node | undefined)?.orderNumber;
      const hits = [...cards.values()].filter((c) =>
        q.tcn ? c.tcn === String(q.tcn) : !order || c.orderNumber === order,
      );
      return xml(
        `<queryTradeCardsResponse xmlns="${NS}">${header(String((q.header as Node).requestId))}<tradeCards>${hits.map(info).join("")}</tradeCards></queryTradeCardsResponse>`,
      );
    }
    const m = doc.manageTradeCardsRequest as Node;
    const ops = ((m.tradeCardOperations as Node).tradeCardOperation ??
      []) as Node[];
    const results = ops.map((op) => {
      const r = apply(op, path === "manageTradeCards");
      const res =
        typeof r === "string"
          ? `<funcCode>ERROR</funcCode><reasonCode>${r}</reasonCode><msg>Szimulált NAV-hiba</msg>`
          : `<funcCode>OK</funcCode><reasonCode>SUCCESS</reasonCode>`;
      return `<operationResult><result>${res}<index>${op.index}</index><operation>${op.operation}</operation></result>${typeof r === "string" ? "" : info(r)}</operationResult>`;
    });
    return xml(
      `<manageTradeCardsResponse xmlns="${NS}">${header(String((m.header as Node).requestId))}<tradeCardOperationsResults>${results.join("")}</tradeCardOperationsResults></manageTradeCardsResponse>`,
    );
  };
  return { fetch: fetch as typeof globalThis.fetch, cards };
}
