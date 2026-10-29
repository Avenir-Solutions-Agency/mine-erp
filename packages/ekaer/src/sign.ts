import { createHash } from "node:crypto";

// EKÁER Management Service 2.2, "requestSignature": uppercase hex SHA-512, as in NAV's example.
const sha512 = (s: string) =>
  createHash("sha512").update(s, "utf8").digest("hex").toUpperCase();

export const passwordHash = (password: string) => sha512(password);

/** The instant as UTC "yyyyMMddHHmmss". */
export const utcStamp = (at: Date) =>
  at.toISOString().replace(/[-:T]/g, "").slice(0, 14);

/** The `timestamp` element: same instant, whole seconds, with Z, so it matches the signature. */
export const xmlTimestamp = (at: Date) =>
  at.toISOString().replace(/\.\d{3}Z$/, "Z");

export const requestSignature = (
  requestId: string,
  at: Date,
  signingKey: string,
) => sha512(requestId + utcStamp(at) + signingKey);
