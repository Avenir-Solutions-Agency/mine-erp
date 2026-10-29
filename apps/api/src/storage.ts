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

  /** Creates a private bucket on first boot; a second call is a no-op. */
  async ensureBucket(name = this.env.INVOICE_BUCKET) {
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

  async remove(paths: string[]) {
    if (!paths.length) return;
    const res = await fetch(this.url(`object/${this.env.INVOICE_BUCKET}`), {
      method: "DELETE",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) throw new Error(`Storage remove: HTTP ${res.status}`);
  }

  /**
   * Writes a file that must never change (issued weigh tickets): no upsert, so a second write of
   * the same path is refused. Returns false when the file already exists.
   */
  async putOnce(
    bucket: string,
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<boolean> {
    const res = await fetch(this.url(`object/${bucket}/${path}`), {
      method: "POST",
      headers: this.headers({
        "content-type": contentType,
        "x-upsert": "false",
      }),
      body: new Uint8Array(body),
    });
    if (res.ok) return true;
    // Supabase answers an existing object with 400/409 "Duplicate".
    if (
      (res.status === 400 || res.status === 409) &&
      (await res.text()).includes("Duplicate")
    )
      return false;
    throw new Error(`Storage upload: HTTP ${res.status}`);
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const res = await fetch(this.url(`object/${bucket}/${path}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Storage download: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
