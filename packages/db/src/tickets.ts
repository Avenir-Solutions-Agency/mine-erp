import { sql } from "drizzle-orm";
import type { Db } from "./index.ts";
import { shipmentRegistryCounter, weighingTicketCounter } from "./schema.ts";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Next gapless ticket sequence for the year. Call it inside the transaction that saves the
 * weighing: the counter row stays locked until commit, and a rollback gives the number back.
 */
export async function nextWeighingTicketSeq(
  tx: Tx,
  year: number,
): Promise<number> {
  const [row] = await tx
    .insert(weighingTicketCounter)
    .values({ year, last: 1 })
    .onConflictDoUpdate({
      target: weighingTicketCounter.year,
      set: { last: sql`${weighingTicketCounter.last} + 1` },
    })
    .returning({ last: weighingTicketCounter.last });
  return row!.last;
}

/** Next gapless shipment registry sequence for the year; same locking rule as the ticket counter. */
export async function nextShipmentRegistrySeq(
  tx: Tx,
  year: number,
): Promise<number> {
  const [row] = await tx
    .insert(shipmentRegistryCounter)
    .values({ year, last: 1 })
    .onConflictDoUpdate({
      target: shipmentRegistryCounter.year,
      set: { last: sql`${shipmentRegistryCounter.last} + 1` },
    })
    .returning({ last: shipmentRegistryCounter.last });
  return row!.last;
}
