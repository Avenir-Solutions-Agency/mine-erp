import { randomInt } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// A stand-in for NAV's EKÁER service, used with EKAER_SIMULATE=true until a test-system user
// exists, and in tests. It remembers reports by orderNumber, so query-before-resend works.

const NS = "http://schemas.nav.gov.hu/EKAER/1.0/ekaermanagement";
const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (n) => n === "tradeCardOperation",
});

type Node = Record<string, unknown>;
interface Card {
  tcn: string;
  orderNumber: string;
  status: "S" | "I";
}

const header = (requestId: string) =>
  `<header><requestId>${requestId}</requestId><timestamp>${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</timestamp><requestVersion>2.1</requestVersion></header><result><funcCode>OK</funcCode><reasonCode>SUCCESS</reasonCode></result>`;
const info = (c: Card) =>
  `<tradeCardInfo><tcn>${c.tcn}</tcn><orderNumber>${c.orderNumber}</orderNumber><tradeType>D</tradeType><status>${c.status}</status></tradeCardInfo>`;
const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status: 200,
    headers: { "content-type": "text/xml" },
  });

export function simulatedNav() {
  const cards = new Map<string, Card>();
  const byTcn = (tcn: string) => [...cards.values()].find((c) => c.tcn === tcn);

  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).split("/").pop();
    const doc = parser.parse(String(init?.body)) as Node;
    if (path === "queryTradeCards") {
      const q = doc.queryTradeCardsRequest as Node;
      const id = String((q.header as Node).requestId);
      const order = (q.queryParams as Node | undefined)?.orderNumber;
      const hits = [...cards.values()].filter((c) =>
        q.tcn ? c.tcn === q.tcn : !order || c.orderNumber === order,
      );
      return xml(
        `<queryTradeCardsResponse xmlns="${NS}">${header(id)}<tradeCards>${hits.map(info).join("")}</tradeCards></queryTradeCardsResponse>`,
      );
    }
    const m = doc.manageTradeCardsRequest as Node;
    const id = String((m.header as Node).requestId);
    const ops = ((m.tradeCardOperations as Node).tradeCardOperation ??
      []) as Node[];
    const results = ops.map((op) => {
      const index = op.index;
      const kind = String(op.operation);
      let card: Card | undefined;
      if (kind === "create") {
        const order = String((op.tradeCard as Node).orderNumber ?? "");
        card = {
          tcn: `E${String(randomInt(1e12)).padStart(12, "0")}SIM`.slice(0, 15),
          orderNumber: order,
          status: "S",
        };
        if (path === "manageTradeCards") cards.set(order, card);
      } else {
        card = byTcn(String(op.tcn));
        if (card && kind === "delete" && path === "manageTradeCards")
          card.status = "I";
      }
      const res = card
        ? `<funcCode>OK</funcCode><reasonCode>SUCCESS</reasonCode>`
        : `<funcCode>ERROR</funcCode><reasonCode>TC_NOT_FOUND</reasonCode><msg>Nincs ilyen bejelentés (szimuláció)</msg>`;
      return `<operationResult><result>${res}<index>${index}</index><operation>${kind}</operation></result>${card ? info(card) : ""}</operationResult>`;
    });
    return xml(
      `<manageTradeCardsResponse xmlns="${NS}">${header(id)}<tradeCardOperationsResults>${results.join("")}</tradeCardOperationsResults></manageTradeCardsResponse>`,
    );
  };
  return { fetch: fetch as typeof globalThis.fetch, cards };
}
