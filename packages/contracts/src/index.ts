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
  /** Below the minimum weight: no vehicle on the bridge (not the same as moving). */
  empty: z.boolean(),
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
  /** The shipment this weighing became (register, PRD F4), if any. */
  shipment: z
    .object({
      registryNumber: z.string(),
      status: z.enum(["registered", "cancelled"]),
    })
    .nullable(),
  /** The latest EKÁER report for this weighing, if any. */
  ekaer: z
    .object({
      id: z.uuid(),
      status: z.enum([
        "pending",
        "active",
        "modifying",
        "finalizing",
        "finalized",
        "deleting",
        "deleted",
        "failed",
      ]),
      plannedKg: z.number().int(),
      tcn: z.string().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
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
  ekaerRequired: z.boolean().optional(),
  /** List price, whole forints per tonne; the value of an automatic EKÁER report (T-020). */
  pricePerTonneHuf: z
    .preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().int().min(0).max(999_999_999).nullable(),
    )
    .optional(),
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
  ekaerRequired: z.boolean(),
  pricePerTonneHuf: z.number().int().nullable(),
  note: z.string().nullable(),
  active: z.boolean(),
});
export type ProductDto = z.infer<typeof ProductDto>;

export const FileEkaerInput = z.object({
  plannedKg: z.number().int().positive().max(999_999_999),
  /** Whole forints as typed; stored as fillér. */
  valueHuf: z.number().int().positive().max(999_999_999),
});

export const DeleteEkaerInput = z.object({
  reason: z.string().trim().min(3).max(200),
});

/** A person-approved weight change, usually the weighed net after the second weighing. */
export const ModifyEkaerInput = z.object({
  kg: z.number().int().positive().max(999_999_999),
  reason: z.string().trim().min(3).max(200),
});

/** Unloading time for finalize; NAV refuses a time in the future. */
export const FinalizeEkaerInput = z.object({
  arrivalAt: z.iso
    .datetime({ offset: true })
    .refine(
      (v) => new Date(v).getTime() <= Date.now() + 5 * 60_000,
      "A lerakodás ideje nem lehet a jövőben.",
    ),
});

export const ShipmentDto = z.object({
  id: z.uuid(),
  registryNumber: z.string(),
  status: z.enum(["registered", "cancelled"]),
  weighingId: z.uuid(),
  plate: z.string(),
  customer: z.string(),
  product: z.string(),
  netKg: z.number().int(),
  shippedAt: z.string(),
  ekaerTcn: z.string().nullable(),
});
export type ShipmentDto = z.infer<typeof ShipmentDto>;

/** One field read from a photo: the value as printed or written (null when absent) and how sure the model is. */
const read = <T extends z.ZodType>(value: T, description: string) =>
  z
    .object({
      value: value.nullable(),
      confidence: z.number().min(0).max(1),
    })
    .describe(description);
const Kg = z.number().int();

/**
 * What AI extraction reads from a photo of a paper weigh ticket and/or delivery note (T-011).
 * The photos usually show both side by side; fields of the missing one are null.
 */
export const PaperExtraction = z.object({
  kind: z
    .enum(["weigh_ticket", "delivery_note", "both", "other"])
    .describe("Mi van a képen: mérlegjegy, szállítólevél, mindkettő vagy más"),
  ticketNumber: read(z.string(), "Mérlegjegy száma, pl. MJ-2026-003277"),
  weighedAt: read(
    z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
    "Mérés időpontja a mérlegjegyen, helyi idő, YYYY-MM-DD HH:MM",
  ),
  plate: read(
    z.string(),
    "Vontató rendszáma kötőjel és szóköz nélkül, pl. TBJ586",
  ),
  trailerPlate: read(z.string(), "Pótkocsi rendszáma kötőjel és szóköz nélkül"),
  grossKg: read(Kg, "Bruttó tömeg kg-ban"),
  tareKg: read(Kg, "Tára kg-ban"),
  netKg: read(Kg, "Nettó tömeg kg-ban"),
  customer: read(z.string(), "Ügyfél (vevő) neve"),
  customerAddress: read(z.string(), "Ügyfél címe"),
  product: read(z.string(), "Anyag, termék megnevezése"),
  loadingAddress: read(
    z.string(),
    "Felrakodási cím (hrsz-szel, ha az áll ott)",
  ),
  unloadingAddress: read(
    z.string(),
    "Lerakodási cím; GPS-koordináta is, ha az áll ott",
  ),
  ekaerNumber: read(
    z.string(),
    "EKÁER-szám, pl. E2610267233595 1; '-' esetén null",
  ),
  deliveryNoteNumber: read(
    z.string(),
    "Szállítólevél sorszáma a betűjellel, pl. Cs 0096867",
  ),
  site: read(
    z.string(),
    "Telephely a szállítólevélen: 'Szállítva ... telephelyről (raktárból)'",
  ),
  noteTonnes: read(
    z.number(),
    "A szállítólevélre kézzel írt mennyiség tonnában, pl. 26,98 → 26.98",
  ),
});
export type PaperExtraction = z.infer<typeof PaperExtraction>;

/** An uploaded photo or scan of a paper weigh ticket or delivery note (T-010), with what was read (T-011). */
export const DocumentDto = z.object({
  id: z.uuid(),
  status: z.enum(["received", "ingested", "extracted", "unreadable"]),
  extraction: PaperExtraction.nullable(),
  fileName: z.string(),
  fileMime: z.string(),
  createdAt: z.string(),
});
export type DocumentDto = z.infer<typeof DocumentDto>;

const Total = z.object({
  key: z.string(),
  count: z.number().int(),
  netKg: z.number().int(),
});

/** Shipments of a Budapest-day range with the accountant's totals (cancelled ones listed, not counted). */
export const ShipmentReportDto = z.object({
  from: z.string(),
  to: z.string(),
  rows: z.array(ShipmentDto),
  total: z.object({ count: z.number().int(), netKg: z.number().int() }),
  byCustomer: z.array(Total),
  byProduct: z.array(Total),
  byCustomerProduct: z.array(Total),
});
export type ShipmentReportDto = z.infer<typeof ShipmentReportDto>;

/** Office switches (T-020). */
export const PolicyDto = z.object({
  /** File the EKÁER report by itself at the second weighing when all data is there. */
  ekaerAuto: z.boolean(),
});
export type PolicyDto = z.infer<typeof PolicyDto>;
export const PolicyPatch = PolicyDto.partial();
