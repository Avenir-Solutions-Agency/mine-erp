import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export * from "./schema.ts";
export { uuidv7 } from "./uuidv7.ts";
export { nextWeighingTicketSeq } from "./tickets.ts";
export { and, asc, desc, eq, inArray } from "drizzle-orm";

/** Server-only: DATABASE_URL carries the database password. */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase session pooler: prepared statements are fine in session mode.
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export type Db = ReturnType<typeof createDb>["db"];
