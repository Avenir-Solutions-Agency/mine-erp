import { randomUUID } from "node:crypto";
import type { EkaerConfig } from "./config.ts";
import { validateRequest } from "./validate.ts";
import {
  type FuncCode,
  maskRequest,
  manageTradeCardsXml,
  type Operation,
  operationResults,
  parseResponse,
  type QueryParams,
  queryTradeCardsXml,
  tradeCardInfos,
} from "./xml.ts";

/** Nothing reached NAV (connection refused, DNS); safe to retry. */
export class EkaerTransportError extends Error {}
/** The request may have reached NAV; query by orderNumber before any resend (ARCHITECTURE §06). */
export class EkaerOutcomeUnknownError extends Error {}
/** HTTP 400 EXPIRED_PASSWORD: a person must renew the EKÁER password; never retry. */
export class EkaerExpiredPasswordError extends Error {}
/** The request failed the local 2.2 XSD check and was not sent. */
export class EkaerSchemaError extends Error {
  constructor(readonly errors: string[]) {
    super(`EKÁER request is not valid against the 2.2 XSD: ${errors[0]}`);
  }
}
/** Any other non-200 answer. */
export class EkaerHttpError extends Error {
  constructor(readonly status: number) {
    super(`EKÁER answered HTTP ${status}`);
  }
}

export interface CallResult<T> {
  requestId: string;
  /** With passwordHash and requestSignature masked: store it as evidence as is. */
  requestXml: string;
  responseXml: string;
  funcCode: FuncCode;
  reasonCode: string;
  msg: string | null;
  result: T;
}

/** Failures that happen before the request leaves this machine. */
const NOT_SENT = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);
const causeCode = (e: unknown) =>
  (e as { cause?: { code?: string } } | undefined)?.cause?.code;

export interface EkaerDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  /** Unique per user, max 50 chars; a UUID without dashes is 32. */
  requestId?: () => string;
  timeoutMs?: number;
}

/**
 * Typed EKÁER calls: build signed 2.2 XML, check it against the XSD, send, parse. No retries, no
 * storage, no decisions: the Temporal workflow (T-014) owns those. Business errors (funcCode
 * ERROR) are returned as data, not thrown.
 */
export function createEkaerClient(cfg: EkaerConfig, deps: EkaerDeps = {}) {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const newId = deps.requestId ?? (() => randomUUID().replaceAll("-", ""));

  async function call<T>(
    path: string,
    root: string,
    build: (requestId: string, at: Date) => string,
    read: (r: Record<string, unknown>) => T,
  ): Promise<CallResult<T>> {
    const requestId = newId();
    const xml = build(requestId, now());
    const errors = await validateRequest(xml);
    if (errors.length) throw new EkaerSchemaError(errors);
    let res: Response;
    try {
      res = await doFetch(`${cfg.baseUrl}/${path}`, {
        method: "POST",
        headers: { "content-type": "text/xml", accept: "text/xml" },
        body: xml,
        signal: AbortSignal.timeout(deps.timeoutMs ?? 30_000),
      });
    } catch (e) {
      const code = causeCode(e);
      if (code && NOT_SENT.has(code))
        throw new EkaerTransportError(`EKÁER not reachable (${code})`, {
          cause: e,
        });
      throw new EkaerOutcomeUnknownError(
        "EKÁER call failed after sending; outcome unknown",
        { cause: e },
      );
    }
    const responseXml = await res.text().catch((e: unknown) => {
      throw new EkaerOutcomeUnknownError("EKÁER response was lost", {
        cause: e,
      });
    });
    if (res.status === 400 && responseXml.includes("EXPIRED_PASSWORD"))
      throw new EkaerExpiredPasswordError("The EKÁER password has expired");
    if (!res.ok) throw new EkaerHttpError(res.status);
    const parsed = parseResponse(responseXml, root);
    return {
      requestId,
      requestXml: maskRequest(xml),
      responseXml,
      funcCode: parsed.funcCode,
      reasonCode: parsed.reasonCode,
      msg: parsed.msg,
      result: read(parsed.root),
    };
  }

  return {
    manageTradeCards: (ops: Operation[]) =>
      call(
        "manageTradeCards",
        "manageTradeCardsResponse",
        (id, at) => manageTradeCardsXml(ops, cfg, id, at),
        operationResults,
      ),
    /** NAV's dry run: XSD and business validation of a manage request, no report is created. */
    validateTradeCardRequest: (ops: Operation[]) =>
      call(
        "validateTradeCardRequest",
        "manageTradeCardsResponse",
        (id, at) => manageTradeCardsXml(ops, cfg, id, at),
        operationResults,
      ),
    queryTradeCards: (query: { tcn: string } | QueryParams) =>
      call(
        "queryTradeCards",
        "queryTradeCardsResponse",
        (id, at) => queryTradeCardsXml(query, cfg, id, at),
        tradeCardInfos,
      ),
  };
}

export type EkaerClient = ReturnType<typeof createEkaerClient>;
