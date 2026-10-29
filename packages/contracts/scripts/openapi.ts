// Writes openapi.json next to package.json from the route list in src/openapi.ts.
import { writeFileSync } from "node:fs";
import { buildOpenApi } from "../src/openapi.ts";

const out = new URL("../openapi.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
