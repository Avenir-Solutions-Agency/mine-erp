import { Inject, Injectable } from "@nestjs/common";
import {
  type Db,
  eventLog,
  incomingInvoice,
  incomingInvoiceLine,
  machine,
  vehicle,
  asc,
  desc,
  eq,
  inArray,
} from "@mine-erp/db";

import type { Actor } from "./auth.ts";

export const DB = Symbol("DB");

type NewInvoice = typeof incomingInvoice.$inferInsert;
type NewLine = Omit<typeof incomingInvoiceLine.$inferInsert, "invoiceId">;
export type InvoiceRow = typeof incomingInvoice.$inferSelect & {
  lines: (typeof incomingInvoiceLine.$inferSelect)[];
};

@Injectable()
export class InvoicesRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async idBySha(sha256: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: incomingInvoice.id })
      .from(incomingInvoice)
      .where(eq(incomingInvoice.fileSha256, sha256));
    return row?.id ?? null;
  }

  async carriers() {
    const [vehicles, machines] = await Promise.all([
      this.db
        .select({
          name: vehicle.plate,
          make: vehicle.make,
          category: vehicle.category,
        })
        .from(vehicle)
        .orderBy(asc(vehicle.plate)),
      this.db
        .select({ name: machine.name, model: machine.model })
        .from(machine)
        .orderBy(asc(machine.name)),
    ]);
    return [
      ...vehicles.map((v) => ({
        name: v.name,
        type: "vehicle" as const,
        detail: [v.make, v.category].filter(Boolean).join(" · ") || null,
      })),
      ...machines.map((m) => ({
        name: m.name,
        type: "machine" as const,
        detail: m.model,
      })),
    ];
  }

  /** Invoice, its lines and the event in one transaction (database rules: writes log events). */
  async create(
    invoice: NewInvoice,
    lines: NewLine[],
    actor: Actor,
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(incomingInvoice)
        .values({ ...invoice, createdBy: actor.id })
        .returning({ id: incomingInvoice.id });
      const id = row!.id;
      if (lines.length)
        await tx
          .insert(incomingInvoiceLine)
          .values(
            lines.map((l) => ({ ...l, invoiceId: id, createdBy: actor.id })),
          );
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "incoming_invoice",
        entityId: id,
        action: "uploaded",
        payload: {
          status: invoice.status,
          costCarrier: invoice.costCarrier,
          path: invoice.filePath,
        },
      });
      return id;
    });
  }

  /** Newest first; lines come in one extra query, not one per invoice. */
  async list(limit: number, ids?: string[]): Promise<InvoiceRow[]> {
    const invoices = await this.db
      .select()
      .from(incomingInvoice)
      .where(ids ? inArray(incomingInvoice.id, ids) : undefined)
      .orderBy(desc(incomingInvoice.createdAt))
      .limit(limit);
    if (!invoices.length) return [];
    const lines = await this.db
      .select()
      .from(incomingInvoiceLine)
      .where(
        inArray(
          incomingInvoiceLine.invoiceId,
          invoices.map((i) => i.id),
        ),
      )
      .orderBy(asc(incomingInvoiceLine.position));
    return invoices.map((i) => ({
      ...i,
      lines: lines.filter((l) => l.invoiceId === i.id),
    }));
  }

  async assign(
    id: string,
    costCarrier: string | null,
    actor: Actor,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(incomingInvoice)
        .set({
          costCarrier,
          status: costCarrier ? "assigned" : "unassigned",
          updatedAt: new Date(),
        })
        .where(eq(incomingInvoice.id, id))
        .returning({ id: incomingInvoice.id });
      if (!updated.length) return false;
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "incoming_invoice",
        entityId: id,
        action: costCarrier ? "carrier_assigned" : "carrier_cleared",
        payload: { costCarrier },
      });
      return true;
    });
  }

  /** Development reset: removes every invoice (lines cascade) and logs one event; returns the stored paths. */
  async deleteAll(actor: Actor): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(incomingInvoice)
        .returning({ path: incomingInvoice.filePath });
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "incoming_invoice",
        action: "reset",
        payload: { removed: removed.length },
      });
      return removed.map((r) => r.path);
    });
  }
}
