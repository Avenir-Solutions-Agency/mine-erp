import { sql } from "drizzle-orm";
import type { Db } from "./index.ts";
import { weighingTicketCounter } from "./schema.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

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
