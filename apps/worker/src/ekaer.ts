// EKÁER filing for one weighing (T-014): the decision logic behind the activities, with the
// database behind a small store so the logic is testable against the NAV simulator.
import {
  customer,
  type Db,
  ekaerReport,
  eq,
  eventLog,
  product,
  weighing,
} from "@mine-erp/db";
import {
  COMPANY,
  ekaerProblems,
  fillerToHuf,
  parseHuAddress,
  vatNumber8,
} from "@mine-erp/domain/ekaer";
import {
  type CallResult,
  type EkaerClient,
  EkaerOutcomeUnknownError,
  EkaerTransportError,
  type TradeCard,
} from "@mine-erp/ekaer";

/** A failure a retry cannot fix (bad data, NAV said no, expired password). */
export class PermanentEkaerError extends Error {}

export interface ReportView {
  id: string;
  status: string;
  orderNumber: string;
  tcn: string | null;
  plannedKg: number;
  value: bigint;
  createdAt: Date;
  deleteReason: string | null;
  requestedKg: number | null;
  changeReason: string | null;
  arrivalAt: Date | null;
  weighing: { status: "open" | "completed" | "void"; plate: string };
  customer: {
    name: string;
    taxNumber: string | null;
    address: string | null;
  } | null;
  product: { name: string; vtsz: string | null; ekaerRequired: boolean } | null;
}

type Evidence = Pick<
  CallResult<unknown>,
  "requestId" | "requestXml" | "responseXml"
>;

export interface ReportStore {
  load(id: string): Promise<ReportView | null>;
  active(id: string, tcn: string, call: Evidence | null): Promise<void>;
  failed(id: string, error: string, call: Evidence | null): Promise<void>;
  deleted(id: string, call: Evidence): Promise<void>;
  /** A delete NAV refused: the report stays active, with the reason recorded. */
  deleteRefused(id: string, error: string, call: Evidence): Promise<void>;
  /** NAV accepted the weight change. */
  modified(id: string, kg: number, call: Evidence): Promise<void>;
  /** NAV took the unloading time; the report is closed. */
  finalized(id: string, call: Evidence): Promise<void>;
  /** A modify or finalize NAV refused or could not apply: back to active, reason kept. */
  changeRefused(
    id: string,
    error: string,
    call: Evidence | null,
  ): Promise<void>;
}

function tradeCard(r: ReportView): TradeCard {
  const unload = parseHuAddress(r.customer!.address)!;
  return {
    orderNumber: r.orderNumber,
    tradeType: "D",
    modByCarrierEnabled: false,
    seller: {
      name: COMPANY.name,
      vatNumber: vatNumber8(COMPANY.taxNumber)!,
      country: "HU",
      address: COMPANY.seat,
    },
    destination: {
      name: r.customer!.name,
      vatNumber: vatNumber8(r.customer!.taxNumber)!,
      country: "HU",
      address: r.customer!.address!,
    },
    vehicle: { plateNumber: r.weighing.plate, country: "HU" },
    deliveryPlans: [
      {
        loadLocation: { country: "HU", ...COMPANY.site },
        unloadLocation: { country: "HU", ...unload },
        items: [
          {
            tradeReason: "S",
            productVtsz: r.product!.vtsz!,
            productName: r.product!.name,
            weightKg: r.plannedKg,
            valueHuf: fillerToHuf(r.value),
          },
        ],
      },
    ],
  };
}

const navError = (r: { reasonCode: string; msg: string | null }) =>
  `NAV: ${r.reasonCode}${r.msg ? ` (${r.msg})` : ""}`;

/**
 * Files the report once. Every attempt first asks NAV for a report with this orderNumber, so a
 * retry after a lost response adopts the existing report instead of filing a duplicate
 * (ARCHITECTURE §06). Transport and unknown-outcome errors are rethrown for Temporal to retry.
 */
export async function fileReport(
  store: ReportStore,
  client: EkaerClient,
  id: string,
): Promise<string> {
  const r = await store.load(id);
  if (!r) throw new PermanentEkaerError(`EKÁER report ${id} not found`);
  if (r.status === "active" && r.tcn) return r.tcn;
  if (r.status !== "pending")
    throw new PermanentEkaerError(`EKÁER report ${id} is ${r.status}`);

  const problems = ekaerProblems({
    weighingStatus: r.weighing.status,
    plate: r.weighing.plate,
    customer: r.customer,
    product: r.product,
    plannedKg: r.plannedKg,
    valueFiller: r.value,
  });
  if (problems.length) {
    await store.failed(id, problems.join(" "), null);
    throw new PermanentEkaerError(problems.join(" "));
  }

  try {
    const found = await client.queryTradeCards({
      insertFromDate: new Date(r.createdAt.getTime() - 3600_000),
      insertToDate: new Date(),
      orderNumber: r.orderNumber,
    });
    const existing = found.result.find(
      (c) => c.orderNumber === r.orderNumber && c.status === "S",
    );
    if (existing) {
      await store.active(id, existing.tcn, found);
      return existing.tcn;
    }
    const call = await client.manageTradeCards([
      { operation: "create", tradeCard: tradeCard(r) },
    ]);
    const op = call.result[0];
    if (!op || op.funcCode === "ERROR" || !op.tcn) {
      const error = op ? navError(op) : navError(call);
      await store.failed(id, error, call);
      throw new PermanentEkaerError(error);
    }
    await store.active(id, op.tcn, call);
    return op.tcn;
  } catch (e) {
    if (
      e instanceof PermanentEkaerError ||
      e instanceof EkaerTransportError ||
      e instanceof EkaerOutcomeUnknownError
    )
      throw e;
    const error = e instanceof Error ? e.message : String(e);
    await store.failed(id, error, null);
    throw new PermanentEkaerError(error);
  }
}

/**
 * Sends the person-approved weight (requestedKg, changeReason) to NAV as a modify. NAV wants its
 * own delivery plan and item ids, so the current report is queried first; that also shows whether
 * the report is still active. Re-sending the same weight is harmless, so retries are safe.
 */
export async function modifyReport(
  store: ReportStore,
  client: EkaerClient,
  id: string,
): Promise<void> {
  const r = await store.load(id);
  if (!r) throw new PermanentEkaerError(`EKÁER report ${id} not found`);
  if (r.status === "active" && r.plannedKg === r.requestedKg) return;
  if (r.status !== "modifying" || !r.tcn || !r.requestedKg || !r.changeReason)
    throw new PermanentEkaerError(
      `EKÁER report ${id} is not waiting for a weight change`,
    );
  const found = await client.queryTradeCards({ tcn: r.tcn });
  const nav = found.result[0];
  const plan = nav?.deliveryPlans[0];
  if (!nav || nav.status !== "S" || !plan?.id || plan.itemIds.length !== 1)
    return store.changeRefused(
      id,
      "A NAV-nál a bejelentés nem aktív vagy nem egytételes; módosítás nem küldhető.",
      found,
    );
  const card = tradeCard({ ...r, plannedKg: r.requestedKg });
  const call = await client.manageTradeCards([
    {
      operation: "modify",
      tradeCard: {
        ...card,
        tcn: r.tcn,
        deliveryPlans: card.deliveryPlans.map((p) => ({
          ...p,
          id: plan.id!,
          items: p.items.map((i) => ({
            ...i,
            id: plan.itemIds[0]!,
            itemOperation: "modify" as const,
            weightModReasonText: r.changeReason!,
          })),
        })),
      },
    },
  ]);
  const op = call.result[0];
  if (op && op.funcCode !== "ERROR")
    return store.modified(id, r.requestedKg, call);
  await store.changeRefused(id, op ? navError(op) : navError(call), call);
}

/** Reports unloading (finalize). Asks NAV first, so a retry after a lost answer does not resend. */
export async function finalizeReport(
  store: ReportStore,
  client: EkaerClient,
  id: string,
): Promise<void> {
  const r = await store.load(id);
  if (!r) throw new PermanentEkaerError(`EKÁER report ${id} not found`);
  if (r.status === "finalized") return;
  if (r.status !== "finalizing" || !r.tcn || !r.arrivalAt)
    throw new PermanentEkaerError(
      `EKÁER report ${id} is not waiting for finalize`,
    );
  const found = await client.queryTradeCards({ tcn: r.tcn });
  if (found.result[0]?.status === "F") return store.finalized(id, found);
  const call = await client.manageTradeCards([
    { operation: "finalize", tcn: r.tcn, arrivalDate: r.arrivalAt },
  ]);
  const op = call.result[0];
  if (op && op.funcCode !== "ERROR") return store.finalized(id, call);
  await store.changeRefused(id, op ? navError(op) : navError(call), call);
}

/** Deletes an active report with the reason the person gave (human-approved by the request). */
export async function deleteReport(
  store: ReportStore,
  client: EkaerClient,
  id: string,
): Promise<void> {
  const r = await store.load(id);
  if (!r) throw new PermanentEkaerError(`EKÁER report ${id} not found`);
  if (r.status === "deleted") return;
  if (r.status !== "deleting" || !r.tcn || !r.deleteReason)
    throw new PermanentEkaerError(
      `EKÁER report ${id} is not waiting for deletion`,
    );
  const call = await client.manageTradeCards([
    { operation: "delete", tcn: r.tcn, reason: r.deleteReason },
  ]);
  const op = call.result[0];
  if (op && op.funcCode !== "ERROR") return store.deleted(id, call);
  await store.deleteRefused(id, op ? navError(op) : navError(call), call);
}

/** The ReportStore on Postgres; every status change writes its event in the same transaction. */
export function dbReportStore(db: Db): ReportStore {
  const change = (
    id: string,
    set: Partial<typeof ekaerReport.$inferInsert>,
    action: string,
  ) =>
    db.transaction(async (tx) => {
      await tx
        .update(ekaerReport)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(ekaerReport.id, id));
      await tx.insert(eventLog).values({
        actorType: "system",
        entity: "ekaer_report",
        entityId: id,
        action,
        payload: {
          status: set.status,
          tcn: set.tcn,
          error: set.error,
          requestId: set.requestId,
        },
      });
    });
  const evidence = (c: Evidence | null) =>
    c
      ? {
          requestId: c.requestId,
          requestXml: c.requestXml,
          responseXml: c.responseXml,
        }
      : {};
  return {
    async load(id) {
      const [row] = await db
        .select({ r: ekaerReport, w: weighing, c: customer, p: product })
        .from(ekaerReport)
        .innerJoin(weighing, eq(weighing.id, ekaerReport.weighingId))
        .leftJoin(customer, eq(customer.id, weighing.customerId))
        .leftJoin(product, eq(product.id, weighing.productId))
        .where(eq(ekaerReport.id, id));
      if (!row) return null;
      return {
        ...row.r,
        weighing: { status: row.w.status, plate: row.w.plate },
        customer: row.c,
        product: row.p,
      };
    },
    active: (id, tcn, c) =>
      change(
        id,
        { status: "active", tcn, error: null, ...evidence(c) },
        "filed",
      ),
    failed: (id, error, c) =>
      change(id, { status: "failed", error, ...evidence(c) }, "failed"),
    deleted: (id, c) =>
      change(id, { status: "deleted", error: null, ...evidence(c) }, "deleted"),
    deleteRefused: (id, error, c) =>
      change(id, { status: "active", error, ...evidence(c) }, "delete_refused"),
    modified: (id, kg, c) =>
      change(
        id,
        {
          status: "active",
          plannedKg: kg,
          requestedKg: null,
          error: null,
          ...evidence(c),
        },
        "modified",
      ),
    finalized: (id, c) =>
      change(
        id,
        { status: "finalized", error: null, ...evidence(c) },
        "finalized",
      ),
    changeRefused: (id, error, c) =>
      change(
        id,
        { status: "active", requestedKg: null, error, ...evidence(c) },
        "change_refused",
      ),
  };
}
