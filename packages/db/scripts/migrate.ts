import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/index.ts";

const { db, close } = createDb();
try {
  await migrate(db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  });
  console.log("migrations applied");
} finally {
  await close();
}
