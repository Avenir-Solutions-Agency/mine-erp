// OpenAPI 3.1 contract of apps/api, generated from the same Zod schemas the API validates with
// (T-005). `pnpm --filter @mine-erp/contracts openapi` writes openapi.json; a test fails when the
// committed file or the API's routes drift from this list.
import { z } from "zod";
import {
  AssignCarrierInput,
  CarrierDto,
  CustomerDto,
  CustomerInput,
  CustomerPatch,
  DocumentDto,
  DeleteEkaerInput,
  FileEkaerInput,
  FinalizeEkaerInput,
  FirstWeighingInput,
  InvoiceDto,
  ModifyEkaerInput,
  PolicyDto,
  PolicyPatch,
  ProductDto,
  ProductInput,
  ProductPatch,
  RegisterDocumentInput,
  ScaleLiveDto,
  ShipmentDto,
  ShipmentReportDto,
  ScaleReadingInput,
  VoidWeighingInput,
  WeighingDto,
} from "./index.ts";

type Auth = "none" | "user" | "agent";
type Body = z.ZodType | "multipart-file" | null;
type Reply = z.ZodType | "pdf" | "xlsx" | "file" | null;

export interface Route {
  method: "get" | "post" | "patch" | "delete";
  /** Nest style, e.g. /weighings/:id/second. */
  path: string;
  summary: string;
  auth: Auth;
  body: Body;
  /** Required query parameters, e.g. a date range. */
  query?: { name: string; description: string }[];
  /** The `data` of a `{ data }` reply (Nest answers POST with 201), a PDF or a file stream; null for 204. */
  reply: Reply;
}

const Ok = z.object({ ok: z.literal(true) });

export const ROUTES: Route[] = [
  {
    method: "get",
    path: "/health",
    summary: "Service health",
    auth: "none",
    body: null,
    reply: z.object({ status: z.literal("ok") }),
  },

  {
    method: "get",
    path: "/invoices",
    summary: "Incoming invoices, newest first (200)",
    auth: "user",
    body: null,
    reply: z.array(InvoiceDto),
  },
  {
    method: "post",
    path: "/invoices",
    summary:
      "Upload an invoice (PDF, JPG, PNG, max 10 MB); AI extraction; stored under YYYY-MM/",
    auth: "user",
    body: "multipart-file",
    reply: InvoiceDto,
  },
  {
    method: "delete",
    path: "/invoices",
    summary:
      "Development only: delete every invoice (needs ALLOW_DATA_RESET=true)",
    auth: "user",
    body: null,
    reply: z.object({ removed: z.number().int() }),
  },
  {
    method: "get",
    path: "/invoices/:id/file",
    summary: "5-minute signed link to the stored invoice file",
    auth: "user",
    body: null,
    reply: z.object({ url: z.url() }),
  },
  {
    method: "patch",
    path: "/invoices/:id/carrier",
    summary: "Assign or clear the cost carrier",
    auth: "user",
    body: AssignCarrierInput,
    reply: InvoiceDto,
  },
  {
    method: "get",
    path: "/carriers",
    summary: "Vehicles and machines that can carry a cost",
    auth: "user",
    body: null,
    reply: z.array(CarrierDto),
  },

  {
    method: "post",
    path: "/scale/readings",
    summary: "One indicator value from the scale agent",
    auth: "agent",
    body: ScaleReadingInput,
    reply: null,
  },
  {
    method: "get",
    path: "/scale/live",
    summary: "Latest weight, the stable weight and whether the bridge is empty",
    auth: "user",
    body: null,
    reply: ScaleLiveDto,
  },

  {
    method: "get",
    path: "/weighings",
    summary: "Weighings, newest first (200), with the latest EKÁER report",
    auth: "user",
    body: null,
    reply: z.array(WeighingDto),
  },
  {
    method: "post",
    path: "/weighings",
    summary:
      "First weighing, or one pass with the saved tare; the weight comes from the scale",
    auth: "user",
    body: FirstWeighingInput,
    reply: WeighingDto,
  },
  {
    method: "post",
    path: "/weighings/:id/second",
    summary: "Second weighing; gross, tare and net",
    auth: "user",
    body: null,
    reply: WeighingDto,
  },
  {
    method: "post",
    path: "/weighings/:id/void",
    summary: "Void with a reason (never deleted)",
    auth: "user",
    body: VoidWeighingInput,
    reply: WeighingDto,
  },
  {
    method: "get",
    path: "/weighings/:id/ticket",
    summary: "Weigh ticket PDF",
    auth: "user",
    body: null,
    reply: "pdf",
  },

  {
    method: "post",
    path: "/weighings/:id/ekaer",
    summary:
      "File an EKÁER report with the planned weight and value (runs in the worker)",
    auth: "user",
    body: FileEkaerInput,
    reply: z.object({ reportId: z.uuid() }),
  },
  {
    method: "post",
    path: "/weighings/:id/ekaer/retry",
    summary:
      "File a failed report again with the same weight and value (NAV is queried first)",
    auth: "user",
    body: null,
    reply: z.object({ reportId: z.uuid() }),
  },
  {
    method: "post",
    path: "/weighings/:id/ekaer/modify",
    summary: "Person-approved weight change of the active report",
    auth: "user",
    body: ModifyEkaerInput,
    reply: Ok,
  },
  {
    method: "post",
    path: "/weighings/:id/ekaer/finalize",
    summary: "Report unloading and close the report",
    auth: "user",
    body: FinalizeEkaerInput,
    reply: Ok,
  },
  {
    method: "post",
    path: "/weighings/:id/ekaer/delete",
    summary: "Delete the active report with a reason",
    auth: "user",
    body: DeleteEkaerInput,
    reply: Ok,
  },

  {
    method: "get",
    path: "/documents",
    summary:
      "Uploaded weigh-ticket and delivery-note photos, newest first (200)",
    auth: "user",
    body: null,
    reply: z.array(DocumentDto),
  },
  {
    method: "post",
    path: "/documents",
    summary:
      "Upload a photo or scan (PDF, JPG, PNG, max 10 MB); stored once by SHA-256, 409 for the same file; starts processDocument",
    auth: "user",
    body: "multipart-file",
    reply: DocumentDto,
  },
  {
    method: "post",
    path: "/documents/:id/register",
    summary:
      "Register a reviewed paper ticket: paper weighing P-<number> and its shipment; EKÁER only without a printed number",
    auth: "user",
    body: RegisterDocumentInput,
    reply: z.object({
      registryNumber: z.string(),
      ekaer: z.enum(["printed", "filed", "none"]),
      warning: z.string().nullable(),
    }),
  },
  {
    method: "get",
    path: "/documents/:id/file",
    summary: "Short-lived link to the uploaded file",
    auth: "user",
    body: null,
    reply: z.object({ url: z.url() }),
  },
  {
    method: "get",
    path: "/shipments",
    summary: "Shipment register, newest first (500), with the EKÁER number",
    auth: "user",
    body: null,
    reply: z.array(ShipmentDto),
  },
  {
    method: "get",
    path: "/shipments/:id/delivery-note",
    summary:
      "Delivery note PDF (number = registry number), archived once; SZTORNÓ copy when cancelled",
    auth: "user",
    body: null,
    reply: "pdf",
  },
  {
    method: "post",
    path: "/weighings/:id/register",
    summary:
      "Register a completed weighing as a shipment (when it was not registered automatically)",
    auth: "user",
    body: null,
    reply: Ok,
  },
  {
    method: "get",
    path: "/reports/shipments",
    summary:
      "Shipments of a Budapest-day range with totals by customer, product and both",
    auth: "user",
    body: null,
    query: [
      { name: "from", description: "First day, YYYY-MM-DD (Budapest)" },
      {
        name: "to",
        description:
          "Last day, YYYY-MM-DD (Budapest), at most a year after from",
      },
    ],
    reply: ShipmentReportDto,
  },
  {
    method: "get",
    path: "/reports/shipments.xlsx",
    summary:
      "The same report as an Excel workbook (Szállítások, Vevők szerint, Termékek szerint)",
    auth: "user",
    body: null,
    query: [
      { name: "from", description: "First day, YYYY-MM-DD (Budapest)" },
      {
        name: "to",
        description:
          "Last day, YYYY-MM-DD (Budapest), at most a year after from",
      },
    ],
    reply: "xlsx",
  },
  {
    method: "get",
    path: "/policy",
    summary: "Office switches (automatic EKÁER at the second weighing)",
    auth: "user",
    body: null,
    reply: PolicyDto,
  },
  {
    method: "patch",
    path: "/policy",
    summary: "Change office switches; logged with the person",
    auth: "user",
    body: PolicyPatch,
    reply: PolicyDto,
  },
  {
    method: "get",
    path: "/customers",
    summary: "Customers",
    auth: "user",
    body: null,
    reply: z.array(CustomerDto),
  },
  {
    method: "post",
    path: "/customers",
    summary: "Create a customer",
    auth: "user",
    body: CustomerInput,
    reply: CustomerDto,
  },
  {
    method: "patch",
    path: "/customers/:id",
    summary: "Change or (de)activate a customer",
    auth: "user",
    body: CustomerPatch,
    reply: CustomerDto,
  },
  {
    method: "get",
    path: "/products",
    summary: "Products",
    auth: "user",
    body: null,
    reply: z.array(ProductDto),
  },
  {
    method: "post",
    path: "/products",
    summary: "Create a product",
    auth: "user",
    body: ProductInput,
    reply: ProductDto,
  },
  {
    method: "patch",
    path: "/products/:id",
    summary: "Change or (de)activate a product",
    auth: "user",
    body: ProductPatch,
    reply: ProductDto,
  },
];

const schema = (s: z.ZodType, io: "input" | "output") => {
  const { $schema: _, ...rest } = z.toJSONSchema(s, {
    io,
    unrepresentable: "any",
  }) as Record<string, unknown>;
  return rest;
};

const ErrorBody = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string", description: "Hungarian, safe to show" },
      },
    },
  },
};

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const path = r.path.replace(/:(\w+)/g, "{$1}");
    const params: Record<string, unknown>[] = [
      ...r.path.matchAll(/:(\w+)/g),
    ].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
    }));
    for (const q of r.query ?? [])
      params.push({
        name: q.name,
        in: "query",
        required: true,
        description: q.description,
        schema: { type: "string", format: "date" },
      });
    const requestBody =
      r.body === null
        ? undefined
        : r.body === "multipart-file"
          ? {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    required: ["file"],
                    properties: {
                      file: {
                        type: "string",
                        contentMediaType: "application/octet-stream",
                      },
                    },
                  },
                },
              },
            }
          : {
              required: true,
              content: {
                "application/json": { schema: schema(r.body, "input") },
              },
            };
    const success =
      r.reply === null
        ? { "204": { description: "Accepted" } }
        : r.reply === "pdf"
          ? {
              "200": {
                description: "PDF",
                content: {
                  "application/pdf": {
                    schema: {
                      type: "string",
                      contentMediaType: "application/pdf",
                    },
                  },
                },
              },
            }
          : r.reply === "xlsx"
            ? {
                "200": {
                  description: "Excel workbook",
                  content: {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                      {
                        schema: {
                          type: "string",
                          contentMediaType:
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        },
                      },
                  },
                },
              }
            : r.reply === "file"
              ? { "200": { description: "File" } }
              : {
                  [r.method === "post" ? "201" : "200"]: {
                    description: "OK",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          required: ["data"],
                          properties: { data: schema(r.reply, "output") },
                        },
                      },
                    },
                  },
                };
    paths[path] ??= {};
    paths[path][r.method] = {
      summary: r.summary,
      ...(r.auth === "none"
        ? { security: [] }
        : r.auth === "agent"
          ? { security: [{ agentToken: [] }] }
          : {}),
      ...(params.length ? { parameters: params } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: {
        ...success,
        default: {
          description: "Error",
          content: { "application/json": { schema: ErrorBody } },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Mészkő-Polgár ERP API",
      version: "0.1.0",
      description:
        "Every reply is { data } or { error: { code, message } }. Office users need a Supabase access token with aal2 (TOTP).",
    },
    servers: [
      { url: "http://localhost:4000", description: "Local development" },
    ],
    security: [{ supabase: [] }],
    components: {
      securitySchemes: {
        supabase: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase access token (aal2)",
        },
        agentToken: {
          type: "http",
          scheme: "bearer",
          description: "SCALE_AGENT_TOKEN of the scale agent",
        },
      },
    },
    paths,
  };
}
