import {
  Body,
  Controller,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  DeleteEkaerInput,
  FileEkaerInput,
  FinalizeEkaerInput,
  ModifyEkaerInput,
  type WeighingDto,
} from "@mine-erp/contracts";
import {
  and,
  customer,
  type Db,
  desc,
  ekaerReport,
  eq,
  eventLog,
  inArray,
  product,
  weighing,
} from "@mine-erp/db";
import { ekaerProblems } from "@mine-erp/domain/ekaer";
import type { Client } from "@temporalio/client";
import { type Actor, AuthGuard, CurrentActor } from "./auth.ts";
import { ApiError, isUniqueViolation } from "./http.ts";
import { DB } from "./invoices.repository.ts";

export const TEMPORAL = Symbol("TEMPORAL");
const TASK_QUEUE = "documents";

/**
 * EKÁER reports for weighings (T-014). The API only checks the data, records the request and
 * starts the worker's workflow; NAV is called from apps/worker, never from here (ARCHITECTURE §05).
 */
@Injectable()
export class EkaerReports {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(TEMPORAL) private readonly temporal: Client,
  ) {}

  /** The newest report per weighing, for the Mérleg list and the ticket. */
  async latestFor(
    weighingIds: string[],
  ): Promise<Map<string, WeighingDto["ekaer"]>> {
    if (!weighingIds.length) return new Map();
    const rows = await this.db
      .select()
      .from(ekaerReport)
      .where(inArray(ekaerReport.weighingId, weighingIds))
      .orderBy(desc(ekaerReport.createdAt));
    const out = new Map<string, WeighingDto["ekaer"]>();
    for (const r of rows)
      if (!out.has(r.weighingId))
        out.set(r.weighingId, {
          id: r.id,
          status: r.status,
          plannedKg: r.plannedKg,
          tcn: r.tcn,
          error: r.error,
        });
    return out;
  }

  async file(
    weighingId: string,
    plannedKg: number,
    valueHuf: number,
    actor: Actor,
    /** Started by the automatic rule at the second weighing (T-020), not by a click. */
    auto = false,
  ) {
    const [row] = await this.db
      .select({ w: weighing, c: customer, p: product })
      .from(weighing)
      .leftJoin(customer, eq(customer.id, weighing.customerId))
      .leftJoin(product, eq(product.id, weighing.productId))
      .where(eq(weighing.id, weighingId));
    if (!row)
      throw new ApiError(404, "not_found", "A mérlegelés nem található.");
    const value = BigInt(valueHuf) * 100n;
    const problems = ekaerProblems({
      weighingStatus: row.w.status,
      plate: row.w.plate,
      customer: row.c,
      product: row.p,
      plannedKg,
      valueFiller: value,
    });
    if (problems.length)
      throw new ApiError(422, "ekaer_not_ready", problems.join(" "));

    const reportId = await this.db
      .transaction(async (tx) => {
        const [r] = await tx
          .insert(ekaerReport)
          .values({
            weighingId,
            status: "pending",
            orderNumber: row.w.ticketNumber,
            plannedKg,
            value,
            createdBy: actor.id,
          })
          .returning({ id: ekaerReport.id });
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "ekaer_report",
          entityId: r!.id,
          action: "requested",
          payload: { weighingId, plannedKg, valueHuf, auto },
        });
        return r!.id;
      })
      .catch((e: unknown) => {
        if (isUniqueViolation(e, "ekaer_report_one_live_per_weighing"))
          throw new ApiError(
            409,
            "already_reported",
            "Ehhez a mérlegeléshez már van EKÁER-bejelentés.",
          );
        throw e;
      });
    await this.start("ekaerReport", `ekaer-${reportId}`, reportId);
    return reportId;
  }

  /** A person asks for deletion with a reason; that request is the human approval (SECURITY.md). */
  async delete(weighingId: string, reason: string, actor: Actor) {
    const reportId = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(ekaerReport)
        .set({
          status: "deleting",
          deleteReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ekaerReport.weighingId, weighingId),
            eq(ekaerReport.status, "active"),
          ),
        )
        .returning({ id: ekaerReport.id });
      if (!r) return null;
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "ekaer_report",
        entityId: r.id,
        action: "delete_approved",
        payload: { reason },
      });
      return r.id;
    });
    if (!reportId)
      throw new ApiError(
        409,
        "not_active",
        "Nincs aktív EKÁER-bejelentés ehhez a mérlegeléshez.",
      );
    await this.start("ekaerDelete", `ekaer-delete-${reportId}`, reportId);
  }

  /** Moves the active report into a person-approved change and starts the worker's workflow. */
  private async change(
    weighingId: string,
    set: Partial<typeof ekaerReport.$inferInsert>,
    action: string,
    workflow: string,
    actor: Actor,
  ) {
    const reportId = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(ekaerReport)
        .set({ ...set, updatedAt: new Date() })
        .where(
          and(
            eq(ekaerReport.weighingId, weighingId),
            eq(ekaerReport.status, "active"),
          ),
        )
        .returning({ id: ekaerReport.id });
      if (!r) return null;
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "ekaer_report",
        entityId: r.id,
        action,
        payload: set,
      });
      return r.id;
    });
    if (!reportId)
      throw new ApiError(
        409,
        "not_active",
        "Nincs aktív EKÁER-bejelentés ehhez a mérlegeléshez.",
      );
    // A report can be modified more than once, so the workflow id carries the request time.
    await this.start(
      workflow,
      `${workflow}-${reportId}-${Date.now()}`,
      reportId,
    );
  }

  /** Weight change after the second weighing; the person's request with a reason is the approval. */
  modify(weighingId: string, kg: number, reason: string, actor: Actor) {
    return this.change(
      weighingId,
      { status: "modifying", requestedKg: kg, changeReason: reason },
      "modify_approved",
      "ekaerModify",
      actor,
    );
  }

  finalize(weighingId: string, arrivalAt: Date, actor: Actor) {
    return this.change(
      weighingId,
      { status: "finalizing", arrivalAt },
      "finalize_requested",
      "ekaerFinalize",
      actor,
    );
  }

  /**
   * Files a failed report again with the same planned weight and value, as a new report row (the
   * failed one stays as evidence). The worker first asks NAV by the ticket number, so a report
   * that did reach NAV is adopted instead of being filed twice.
   */
  async retry(weighingId: string, actor: Actor) {
    const [last] = await this.db
      .select()
      .from(ekaerReport)
      .where(eq(ekaerReport.weighingId, weighingId))
      .orderBy(desc(ekaerReport.createdAt))
      .limit(1);
    if (last?.status !== "failed")
      throw new ApiError(
        409,
        "not_failed",
        "Csak sikertelen EKÁER-bejelentés próbálható újra.",
      );
    const reportId = await this.db
      .transaction(async (tx) => {
        const [r] = await tx
          .insert(ekaerReport)
          .values({
            weighingId,
            status: "pending",
            orderNumber: last.orderNumber,
            plannedKg: last.plannedKg,
            value: last.value,
            createdBy: actor.id,
          })
          .returning({ id: ekaerReport.id });
        await tx.insert(eventLog).values({
          actorId: actor.id,
          actorType: "person",
          entity: "ekaer_report",
          entityId: r!.id,
          action: "retry_requested",
          payload: { previousReportId: last.id },
        });
        return r!.id;
      })
      .catch((e: unknown) => {
        if (isUniqueViolation(e, "ekaer_report_one_live_per_weighing"))
          throw new ApiError(
            409,
            "already_reported",
            "Ehhez a mérlegeléshez már van folyamatban lévő bejelentés.",
          );
        throw e;
      });
    await this.start("ekaerReport", `ekaer-${reportId}`, reportId);
    return reportId;
  }

  private async start(workflow: string, workflowId: string, reportId: string) {
    try {
      await this.temporal.workflow.start(workflow, {
        taskQueue: TASK_QUEUE,
        workflowId,
        args: [reportId],
      });
    } catch {
      // The request is recorded; without Temporal nobody would ever pick it up, so say so.
      throw new ApiError(
        503,
        "worker_unavailable",
        "A kérés rögzítve, de a háttérfolyamat nem indult el (Temporal nem érhető el).",
      );
    }
  }
}

@Controller("weighings")
@UseGuards(AuthGuard)
export class EkaerReportsController {
  constructor(private readonly reports: EkaerReports) {}

  @Post(":id/ekaer")
  async file(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = FileEkaerInput.safeParse(body);
    if (!input.success)
      throw new ApiError(
        400,
        "invalid_input",
        "Adja meg a tervezett tömeget (kg) és az értéket (Ft).",
      );
    return {
      data: {
        reportId: await this.reports.file(
          id,
          input.data.plannedKg,
          input.data.valueHuf,
          actor,
        ),
      },
    };
  }

  @Post(":id/ekaer/delete")
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = DeleteEkaerInput.safeParse(body);
    if (!input.success)
      throw new ApiError(
        400,
        "invalid_input",
        "A törléshez legalább 3 karakteres indoklás kell.",
      );
    await this.reports.delete(id, input.data.reason, actor);
    return { data: { ok: true } };
  }

  @Post(":id/ekaer/modify")
  async modify(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = ModifyEkaerInput.safeParse(body);
    if (!input.success)
      throw new ApiError(
        400,
        "invalid_input",
        "Adja meg az új tömeget (kg) és az indoklást.",
      );
    await this.reports.modify(id, input.data.kg, input.data.reason, actor);
    return { data: { ok: true } };
  }

  @Post(":id/ekaer/finalize")
  async finalize(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = FinalizeEkaerInput.safeParse(body);
    if (!input.success)
      throw new ApiError(
        400,
        "invalid_input",
        input.error.issues[0]?.message ?? "Hibás lerakodási idő.",
      );
    await this.reports.finalize(id, new Date(input.data.arrivalAt), actor);
    return { data: { ok: true } };
  }

  @Post(":id/ekaer/retry")
  async retry(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return { data: { reportId: await this.reports.retry(id, actor) } };
  }
}
