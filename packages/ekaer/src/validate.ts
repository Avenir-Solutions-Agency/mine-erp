import { readFile } from "node:fs/promises";
import { validateXML } from "xmllint-wasm";

// NAV's 2.2 schemas (ekaer.nav.gov.hu FAQ, ekaermanagement.xsd_.2.2.zip, May 2025), kept in xsd/.
const schemas = Promise.all(
  ["ekaermanagement.xsd", "common.xsd"].map((f) =>
    readFile(new URL(`../xsd/${f}`, import.meta.url), "utf8"),
  ),
);

/** Validates a request against the 2.2 XSDs locally; NAV rejects wrong order or namespaces since 2.0. */
export async function validateRequest(xml: string): Promise<string[]> {
  const [management, common] = await schemas;
  const result = await validateXML({
    xml: [{ fileName: "request.xml", contents: xml }],
    schema: [management],
    preload: [{ fileName: "common.xsd", contents: common }],
  });
  return result.valid ? [] : result.errors.map((e) => e.message);
}
