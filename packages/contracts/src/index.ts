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

/** One indicator value from the scale agent; the API stamps the time on arrival. */
export const ScaleReadingInput = z.object({
  kg: z.number().finite().min(-1000).max(200_000),
});

export const ScaleLiveDto = z.object({
  /** Latest value, or null when the agent has not reported for a while. */
  kg: z.number().nullable(),
  /** The weight a weighing would record now, or null while moving or empty. */
  stableKg: z.number().int().nullable(),
  online: z.boolean(),
});
export type ScaleLiveDto = z.infer<typeof ScaleLiveDto>;

const Text = (max: number) => z.string().trim().max(max).nullable().optional();

export const FirstWeighingInput = z.object({
  plate: z.string().trim().min(2).max(20),
  trailerPlate: Text(20),
  customer: Text(200),
  material: Text(200),
  note: Text(500),
  customerId: z.uuid().nullable().optional(),
  productId: z.uuid().nullable().optional(),
  /** One pass with the vehicle's saved tare instead of a second weighing. */
  useSavedTare: z.boolean().optional(),
});
export type FirstWeighingInput = z.infer<typeof FirstWeighingInput>;

export const VoidWeighingInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const WeighingDto = z.object({
  id: z.uuid(),
  ticketNumber: z.string(),
  status: z.enum(["open", "completed", "void"]),
  plate: z.string(),
  trailerPlate: z.string().nullable(),
  customer: z.string().nullable(),
  material: z.string().nullable(),
  note: z.string().nullable(),
  firstKg: z.number().int(),
  firstAt: z.string(),
  secondKg: z.number().int().nullable(),
  secondAt: z.string().nullable(),
  grossKg: z.number().int().nullable(),
  tareKg: z.number().int().nullable(),
  netKg: z.number().int().nullable(),
  savedTare: z.boolean(),
  voidReason: z.string().nullable(),
});
export type WeighingDto = z.infer<typeof WeighingDto>;

const Opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Hungarian tax number, e.g. 12345678-2-42. */
const TaxNumber = z
  .string()
  .trim()
  .regex(/^\d{8}-\d-\d{2}$/, "Adószám: 12345678-1-12 formában.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const CustomerInput = z.object({
  name: z.string().trim().min(2).max(200),
  taxNumber: TaxNumber,
  address: Opt(300),
  note: Opt(500),
});
export const CustomerPatch = CustomerInput.partial().extend({
  active: z.boolean().optional(),
});
export const CustomerDto = z.object({
  id: z.uuid(),
  name: z.string(),
  taxNumber: z.string().nullable(),
  address: z.string().nullable(),
  note: z.string().nullable(),
  active: z.boolean(),
});
export type CustomerDto = z.infer<typeof CustomerDto>;

export const ProductInput = z.object({
  name: z.string().trim().min(2).max(200),
  fractionCode: Opt(20),
  /** Customs tariff number (VTSZ), 4 to 8 digits. */
  vtsz: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "VTSZ: 4–8 számjegy.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  note: Opt(500),
});
export const ProductPatch = ProductInput.partial().extend({
  active: z.boolean().optional(),
});
export const ProductDto = z.object({
  id: z.uuid(),
  name: z.string(),
  fractionCode: z.string().nullable(),
  vtsz: z.string().nullable(),
  note: z.string().nullable(),
  active: z.boolean(),
});
export type ProductDto = z.infer<typeof ProductDto>;
