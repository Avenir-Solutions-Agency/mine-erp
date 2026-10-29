import { Inject, Injectable } from "@nestjs/common";
import { InvoiceExtraction } from "@mine-erp/contracts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ENV, type Env } from "./env.ts";

export const PROMPT_VERSION = "invoice-v2";

const INSTRUCTIONS = `Magyar bejövő számlát kapsz (PDF vagy fotó). Olvasd ki az adatokat pontosan úgy, ahogy a dokumentumon állnak.
- Ha egy mező nincs rajta vagy nem olvasható, adj null-t. Ne találgass.
- Dátumok YYYY-MM-DD formában. Összegek számként, a számla pénznemében, ezres elválasztó nélkül.
- Csak a nyomtatott számlaadatokat olvasd ki. A kézzel írt jegyzeteket, aláírásokat és bélyegzőket hagyd figyelmen kívül.
- A tételek sorrendje egyezzen a számláéval.`;

/**
 * shortcut: called inside the upload request; ARCHITECTURE §04 wants a Temporal activity with
 * retries (T-009/T-011). Fine while uploads are one at a time from the office.
 */
@Injectable()
export class InvoiceExtractor {
  private readonly client: OpenAI;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 2,
      timeout: 90_000,
    });
  }

  async extract(file: Buffer, fileName: string, mime: string) {
    const data = `data:${mime};base64,${file.toString("base64")}`;
    const content =
      mime === "application/pdf"
        ? { type: "input_file" as const, filename: fileName, file_data: data }
        : {
            type: "input_image" as const,
            image_url: data,
            detail: "high" as const,
          };
    const res = await this.client.responses.parse({
      model: this.env.OPENAI_MODEL,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content: [content] }],
      text: { format: zodTextFormat(InvoiceExtraction, "invoice") },
    });
    // parse() validated the JSON against the schema; null means the model refused.
    return {
      result: res.output_parsed,
      model: res.model,
      promptVersion: PROMPT_VERSION,
    };
  }
}
