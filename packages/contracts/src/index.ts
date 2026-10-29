import { z } from "zod";

/**
 * What the AI must return for one invoice. Every field is required but nullable, as OpenAI
 * structured outputs demand; null means "not on the document or not readable".
 * Amounts are in the invoice currency as printed (forints may have decimals on foreign invoices).
 */
export const InvoiceExtraction = z.object({
  supplier: z.string().nullable(),
  supplierTaxNumber: z.string().nullable(),
  number: z.string().nullable(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Számla kelte, YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  paymentMethod: z.string().nullable(),
  currency: z.string().length(3).nullable(),
  category: z
    .string()
    .nullable()
    .describe(
      "Rövid magyar költségkategória, pl. Üzemanyag, Alkatrész, Szerviz",
    ),
  net: z.number().nullable(),
  vat: z.number().nullable(),
  gross: z.number().nullable(),
  lines: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      unitPrice: z.number().nullable(),
      net: z.number().nullable(),
      vatRate: z.number().nullable(),
      gross: z.number().nullable(),
    }),
  ),
});
export type InvoiceExtraction = z.infer<typeof InvoiceExtraction>;

export const InvoiceStatus = z.enum(["needs_review", "assigned", "unassigned"]);

/** Money crosses the wire as forint strings with up to two decimals ("12345.50"), never floats. */
const Money = z.string().nullable();

export const InvoiceLineDto = z.object({
  name: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  unitPrice: Money,
  net: Money,
  vatRate: z.number().nullable(),
  gross: Money,
});

export const InvoiceDto = z.object({
  id: z.uuid(),
  supplier: z.string().nullable(),
  supplierTaxNumber: z.string().nullable(),
  number: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  category: z.string().nullable(),
  currency: z.string(),
  net: Money,
  vat: Money,
  gross: Money,
  warning: z.string().nullable(),
  status: InvoiceStatus,
  costCarrier: z.string().nullable(),
  fileName: z.string(),
  createdAt: z.string(),
  lines: z.array(InvoiceLineDto),
});
export type InvoiceDto = z.infer<typeof InvoiceDto>;

export const CarrierDto = z.object({
  name: z.string(),
  type: z.enum(["vehicle", "machine"]),
  detail: z.string().nullable(),
});
export type CarrierDto = z.infer<typeof CarrierDto>;

export const AssignCarrierInput = z.object({
  costCarrier: z.string().trim().min(1).max(100).nullable(),
});
