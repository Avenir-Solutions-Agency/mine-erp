// AI extraction of paper weigh tickets and delivery notes (PRD F2, T-011). Runs only inside the
// extract activity; the photo goes to OpenAI (a sub-processor listed in docs/SECURITY.md).
import { PaperExtraction } from "@mine-erp/contracts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

export const PROMPT_VERSION = "paper-v1";

const INSTRUCTIONS = `Fotót kapsz egy kőbánya papír mérlegjegyéről és/vagy kézzel kitöltött szállítólevéléről; gyakran mindkettő egymás mellett van a képen.
- Minden mezőt pontosan úgy olvass ki, ahogy a papíron áll. Ha nincs rajta vagy nem olvasható, a value legyen null. Ne találgass, ne számolj.
- A confidence 0 és 1 közötti szám: mennyire biztos az olvasat. Kézírásnál, elmosódásnál, takarásnál legyen alacsony.
- A tömegek egész kg-ban, ezres elválasztó nélkül (41 860 → 41860).
- A rendszámokat kötőjel és szóköz nélkül, nagybetűvel add meg (TBJ-586 → TBJ586). A mérlegjegyen "TBJ586 / XUN434" alakban a vontató és a pótkocsi áll.
- A szállítólevél fejlécében előnyomott cég (Mészkő-Polgár Kft.) a szállító, nem a vevő; a vevő a mérlegjegy "Ügyfél" mezője.
- Az aláírásokat, bélyegzőket és a QR-kódot hagyd figyelmen kívül.`;

export interface ExtractionResult {
  result: PaperExtraction | null;
  model: string;
  promptVersion: string;
}

export type Extract = (
  file: Buffer,
  fileName: string,
  mime: string,
) => Promise<ExtractionResult>;

/** shortcut: no evaluation set yet; the four sample photos of 2026-10-26 were checked by hand. */
export function openAiExtractor(apiKey: string, model: string): Extract {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 90_000 });
  return async (file, fileName, mime) => {
    const data = `data:${mime};base64,${file.toString("base64")}`;
    const content =
      mime === "application/pdf"
        ? { type: "input_file" as const, filename: fileName, file_data: data }
        : {
            type: "input_image" as const,
            image_url: data,
            detail: "high" as const,
          };
    const res = await client.responses.parse({
      model,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content: [content] }],
      text: { format: zodTextFormat(PaperExtraction, "paper") },
    });
    // parse() validated the JSON against the schema; null means the model refused.
    return {
      result: res.output_parsed,
      model: res.model,
      promptVersion: PROMPT_VERSION,
    };
  };
}

/** Reads a stored file from Supabase Storage with the secret key (server only). */
export function storageDownload(
  url: string,
  secretKey: string,
  bucket: string,
) {
  return async (path: string): Promise<Buffer> => {
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Storage download: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}
