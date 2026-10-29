import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "./env.ts";

/** Supabase Storage over its REST API with the secret key (server only), so no S3 SDK is needed. */
@Injectable()
export class Storage {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private url(path: string) {
    return `${this.env.SUPABASE_URL}/storage/v1/${path}`;
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
      ...extra,
    };
  }

  /** Creates the private bucket on first boot; a second call is a no-op. */
  async ensureBucket() {
    const name = this.env.INVOICE_BUCKET;
    const res = await fetch(this.url(`bucket/${name}`), {
      headers: this.headers(),
    });
    if (res.ok) return;
    const created = await fetch(this.url("bucket"), {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({
        id: name,
        name,
        public: false,
        file_size_limit: 10 * 1024 * 1024,
      }),
    });
    if (!created.ok)
      throw new Error(`Storage bucket ${name}: HTTP ${created.status}`);
  }

  /** Same path twice is fine: the content is addressed by its SHA-256. */
  async upload(path: string, body: Buffer, contentType: string) {
    const res = await fetch(
      this.url(`object/${this.env.INVOICE_BUCKET}/${path}`),
      {
        method: "POST",
        headers: this.headers({
          "content-type": contentType,
          "x-upsert": "true",
        }),
        body: new Uint8Array(body),
      },
    );
    if (!res.ok) throw new Error(`Storage upload: HTTP ${res.status}`);
  }

  /** Short-lived link for the invoice image modal. */
  async signedUrl(path: string, expiresIn = 300): Promise<string> {
    const res = await fetch(
      this.url(`object/sign/${this.env.INVOICE_BUCKET}/${path}`),
      {
        method: "POST",
        headers: this.headers({ "content-type": "application/json" }),
        body: JSON.stringify({ expiresIn }),
      },
    );
    if (!res.ok) throw new Error(`Storage sign: HTTP ${res.status}`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${this.env.SUPABASE_URL}/storage/v1${signedURL}`;
  }
}
