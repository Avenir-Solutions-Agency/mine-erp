import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  type Db,
  desc,
  eq,
  eventLog,
  nextWeighingTicketSeq,
  type Tx,
  vehicle,
  weighing,
} from "@mine-erp/db";
import type { Actor } from "./auth.ts";
import { DB } from "./invoices.repository.ts";

export type WeighingRow = typeof weighing.$inferSelect;
type NewWeighing = Omit<
  typeof weighing.$inferInsert,
  "ticketYear" | "ticketSeq" | "ticketNumber"
>;
type Change = Partial<typeof weighing.$inferInsert>;

@Injectable()
export class WeighingsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async vehicleByPlate(plate: string) {
    const [v] = await this.db
      .select({ id: vehicle.id, tareKg: vehicle.tareKg })
      .from(vehicle)
      .where(eq(vehicle.plate, plate));
    return v ?? null;
  }

  async openForPlate(plate: string) {
    const [w] = await this.db
      .select({ id: weighing.id, ticketNumber: weighing.ticketNumber })
      .from(weighing)
      .where(and(eq(weighing.plate, plate), eq(weighing.status, "open")));
    return w ?? null;
  }

  async get(id: string): Promise<WeighingRow | null> {
    const [w] = await this.db
      .select()
      .from(weighing)
      .where(eq(weighing.id, id));
    return w ?? null;
  }

  async list(limit: number): Promise<WeighingRow[]> {
    return this.db
      .select()
      .from(weighing)
      .orderBy(desc(weighing.firstAt))
      .limit(limit);
  }

  /** Ticket number, row and event in one transaction, so a failure leaves no gap. */
  async create(
    row: NewWeighing,
    year: number,
    ticketNumber: (seq: number) => string,
    actor: Actor,
    /** Runs in the same transaction after the row is written (e.g. registering a shipment). */
    also?: (tx: Tx, w: WeighingRow) => Promise<unknown>,
  ): Promise<WeighingRow> {
    return this.db.transaction(async (tx) => {
      const seq = await nextWeighingTicketSeq(tx, year);
      const [w] = await tx
        .insert(weighing)
        .values({
          ...row,
          ticketYear: year,
          ticketSeq: seq,
          ticketNumber: ticketNumber(seq),
          createdBy: actor.id,
        })
        .returning();
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "weighing",
        entityId: w!.id,
        action:
          row.status === "completed" ? "weighed_saved_tare" : "first_weighing",
        payload: {
          ticketNumber: w!.ticketNumber,
          plate: w!.plate,
          firstKg: w!.firstKg,
        },
      });
      await also?.(tx, w!);
      return w!;
    });
  }

  /** Changes a row only if it is still in the expected status (no lost update between two clicks). */
  async update(
    id: string,
    expected: WeighingRow["status"],
    change: Change,
    action: string,
    actor: Actor,
    also?: (tx: Tx, w: WeighingRow) => Promise<unknown>,
  ): Promise<WeighingRow | null> {
    return this.db.transaction(async (tx) => {
      const [w] = await tx
        .update(weighing)
        .set({ ...change, updatedAt: new Date() })
        .where(and(eq(weighing.id, id), eq(weighing.status, expected)))
        .returning();
      if (!w) return null;
      await tx.insert(eventLog).values({
        actorId: actor.id,
        actorType: "person",
        entity: "weighing",
        entityId: id,
        action,
        payload: change,
      });
      await also?.(tx, w);
      return w;
    });
  }
}
