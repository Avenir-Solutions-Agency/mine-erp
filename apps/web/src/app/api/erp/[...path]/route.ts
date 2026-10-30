import { env } from "@/lib/env";
import { accessToken } from "@/lib/session";

// Backend-for-frontend: the browser calls /api/erp/*, this adds the Supabase token from the
// httpOnly cookie and forwards to the NestJS API. Only the API's own routes pass through.
const SAFE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED =
  /^(invoices(\/[0-9a-f-]{36}(\/(file|carrier))?)?|carriers|policy|shipments|reports\/shipments(\.xlsx)?|(customers|products)(\/[0-9a-f-]{36})?|scale\/live|weighings(\/[0-9a-f-]{36}\/(second|void|ticket|register|ekaer|ekaer\/(delete|modify|finalize|retry)))?)$/;

async function forward(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  if (!ALLOWED.test(path))
    return Response.json(
      { error: { code: "not_found", message: "Nincs ilyen végpont." } },
      { status: 404 },
    );
  if (!env.API_BASE_URL)
    return Response.json(
      {
        error: {
          code: "no_api",
          message: "Az API nincs beállítva (API_BASE_URL).",
        },
      },
      { status: 503 },
    );
  const token = await accessToken();
  if (!token)
    return Response.json(
      { error: { code: "unauthenticated", message: "Jelentkezzen be." } },
      { status: 401 },
    );
  const headers = new Headers({ authorization: `Bearer ${token}` });
  const type = request.headers.get("content-type");
  if (type) headers.set("content-type", type);
  try {
    const target = new URL(path, `${env.API_BASE_URL}/`);
    // Forward the query (report date ranges), except the BFF's own "raw" switch.
    new URL(request.url).searchParams.forEach((v, k) => {
      if (k !== "raw") target.searchParams.append(k, v);
    });
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    // ?raw=1 streams the file itself from our origin, so the modal's frame can be printed.
    if (
      path.endsWith("/file") &&
      res.ok &&
      new URL(request.url).searchParams.has("raw")
    ) {
      const { data } = (await res.json()) as { data: { url: string } };
      const file = await fetch(data.url, { cache: "no-store" });
      // Served from our origin, so only the three uploadable types render; anything else downloads.
      const type = file.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();
      const safe = SAFE_TYPES.has(type ?? "")
        ? type!
        : "application/octet-stream";
      return new Response(file.body, {
        status: file.status,
        headers: {
          "content-type": safe,
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store",
        },
      });
    }
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        // Keeps the file name of downloads (Excel report).
        ...(res.headers.get("content-disposition")
          ? { "content-disposition": res.headers.get("content-disposition")! }
          : {}),
      },
    });
  } catch {
    return Response.json(
      { error: { code: "api_down", message: "Az API nem érhető el." } },
      { status: 502 },
    );
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
