"use client";

// Browser side of the /api/erp BFF: real data screens (Számlák, Mérleg) call the NestJS API through it.

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the API through the BFF; errors carry the API's Hungarian message. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/erp/${path}`, init);
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message: string };
  } | null;
  if (!res.ok || !body || body.data === undefined)
    throw new ApiFailure(
      res.status,
      body?.error?.message ?? "Váratlan hiba, próbálja újra.",
    );
  return body.data;
}
