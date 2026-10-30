import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "./uuidv7.ts";

const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());
const audit = {
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};
// Money in integer fillér (ARCHITECTURE §06).
const money = (name: string) => bigint(name, { mode: "bigint" });

/** Vehicles from the registration-certificate summary sheet. */
export const vehicle = pgTable("vehicle", {
  id: id(),
  plate: text("plate").notNull().unique(),
  group: text("group"),
  category: text("category"),
  make: text("make"),
  model: text("model"),
  engineNumber: text("engine_number"),
  powerKw: integer("power_kw"),
  /** Saved tare for one-pass weighing, kg. */
  tareKg: integer("tare_kg"),
  vin: text("vin"),
  v9Code: text("v9_code"),
  euroClass: text("euro_class"),
  year: integer("year"),
  operator: text("operator"),
  owner: text("owner"),
  note: text("note"),
  source: text("source"),
  folderUrl: text("folder_url"),
  ...audit,
});

/** Loaders and other machines from the machine summary workbook. */
export const machine = pgTable("machine", {
  id: id(),
  name: text("name").notNull().unique(),
  make: text("make"),
  model: text("model"),
  serialNumber: text("serial_number"),
  year: integer("year"),
  note: text("note"),
  // The workbook has more columns than we query; kept whole so nothing is lost.
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull(),
  ...audit,
});

export type InvoiceStatus = "needs_review" | "assigned" | "unassigned";

export const incomingInvoice = pgTable(
  "incoming_invoice",
  {
    id: id(),
    supplier: text("supplier"),
    supplierTaxNumber: text("supplier_tax_number"),
    number: text("number"),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    paymentMethod: text("payment_method"),
    category: text("category"),
    currency: text("currency").notNull().default("HUF"),
    net: money("net"),
    vat: money("vat"),
    gross: money("gross"),
    handwriting: text("handwriting"),
    warning: text("warning"),
    status: text("status").$type<InvoiceStatus>().notNull(),
    costCarrier: text("cost_carrier"),
    fileSha256: text("file_sha256").notNull().unique(),
    filePath: text("file_path").notNull(),
    fileName: text("file_name").notNull(),
    fileMime: text("file_mime").notNull(),
    // Raw model output with model id and prompt version, kept as evidence.
    extraction: jsonb("extraction"),
    ...audit,
  },
  (t) => [index("incoming_invoice_issue_date_idx").on(t.issueDate)],
);

export const incomingInvoiceLine = pgTable(
  "incoming_invoice_line",
  {
    id: id(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => incomingInvoice.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }),
    unit: text("unit"),
    unitPrice: money("unit_price"),
    net: money("net"),
    vatRate: integer("vat_rate"),
    gross: money("gross"),
    ...audit,
  },
  (t) => [index("incoming_invoice_line_invoice_id_idx").on(t.invoiceId)],
);

/**
 * jsonb that also takes bigint (fillér amounts): stored as a decimal string, since JSON has no
 * bigint and the default serializer throws. Same column type in the database, no migration.
 */
export const eventPayload = customType<{ data: unknown; driverData: string }>({
  dataType: () => "jsonb",
  toDriver: (v) =>
    JSON.stringify(v, (_k, x: unknown) =>
      typeof x === "bigint" ? x.toString() : x,
    ),
});

/** Append-only; see the migration for the grants. */
export const eventLog = pgTable("event_log", {
  id: id(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  actorId: uuid("actor_id"),
  actorType: text("actor_type").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  payload: eventPayload("payload"),
});

/** Buyers; no delete, inactive ones stay because old weigh tickets point at them. */
export const customer = pgTable("customer", {
  id: id(),
  name: text("name").notNull(),
  taxNumber: text("tax_number").unique(),
  address: text("address"),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  ...audit,
});

/** Products sold over the scale; VTSZ decides the EKÁER obligation later. */
export const product = pgTable("product", {
  id: id(),
  name: text("name").notNull().unique(),
  fractionCode: text("fraction_code"),
  vtsz: text("vtsz"),
  /** Set by hand until the accountant's rule (VTSZ + threshold) is known (PRD §08). */
  ekaerRequired: boolean("ekaer_required").notNull().default(false),
  /** List price per tonne in fillér; the EKÁER value of an automatic report (T-020). */
  pricePerTonne: money("price_per_tonne"),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  ...audit,
});

export type WeighingStatus = "open" | "completed" | "void";

/** One pass or two over the weighbridge; never deleted, a cancelled one is `void`. */
export const weighing = pgTable(
  "weighing",
  {
    id: id(),
    ticketYear: integer("ticket_year").notNull(),
    ticketSeq: integer("ticket_seq").notNull(),
    ticketNumber: text("ticket_number").notNull().unique(),
    status: text("status").$type<WeighingStatus>().notNull(),
    plate: text("plate").notNull(),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id),
    trailerPlate: text("trailer_plate"),
    // Names as they were at weighing time (the ticket must not change if master data is renamed).
    customer: text("customer"),
    material: text("material"),
    customerId: uuid("customer_id").references(() => customer.id),
    productId: uuid("product_id").references(() => product.id),
    note: text("note"),
    firstKg: integer("first_kg").notNull(),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull(),
    secondKg: integer("second_kg"),
    secondAt: timestamp("second_at", { withTimezone: true }),
    grossKg: integer("gross_kg"),
    tareKg: integer("tare_kg"),
    netKg: integer("net_kg"),
    savedTare: boolean("saved_tare").notNull().default(false),
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    /** The issued ticket PDF in the weigh-tickets bucket, written once, with its SHA-256 as evidence. */
    ticketPath: text("ticket_path"),
    ticketSha256: text("ticket_sha256"),
    /** The SZTORNÓ copy, issued when the weighing is voided; the original stays. */
    voidTicketPath: text("void_ticket_path"),
    voidTicketSha256: text("void_ticket_sha256"),
    ...audit,
  },
  (t) => [
    index("weighing_first_at_idx").on(t.firstAt),
    index("weighing_plate_idx").on(t.plate),
    // At most one open weighing per vehicle, even if two first weighings race.
    uniqueIndex("weighing_one_open_per_plate")
      .on(t.plate)
      .where(sql`${t.status} = 'open'`),
    check(
      "weighing_status_chk",
      sql`${t.status} in ('open', 'completed', 'void')`,
    ),
    check("weighing_first_kg_chk", sql`${t.firstKg} > 0`),
    check(
      "weighing_net_chk",
      sql`${t.netKg} is null or (${t.netKg} = ${t.grossKg} - ${t.tareKg} and ${t.netKg} > 0)`,
    ),
    check(
      "weighing_completed_chk",
      sql`${t.status} <> 'completed' or (${t.grossKg} is not null and ${t.tareKg} is not null and ${t.netKg} is not null)`,
    ),
    check(
      "weighing_void_chk",
      sql`${t.status} <> 'void' or (${t.voidReason} is not null and ${t.voidedAt} is not null)`,
    ),
  ],
);

/** Gapless MJ-YYYY-NNNNNN numbers: one row per year, bumped in the transaction that saves the weighing. */
export const weighingTicketCounter = pgTable("weighing_ticket_counter", {
  year: integer("year").primaryKey(),
  last: integer("last").notNull(),
});

export type EkaerReportStatus =
  | "pending"
  | "active"
  | "modifying"
  | "finalizing"
  | "finalized"
  | "deleting"
  | "deleted"
  | "failed";

/**
 * One EKÁER report (trade card) for a weighing. The request and response XML (credentials masked)
 * are the evidence. shortcut: kept in the row; ARCHITECTURE §06 wants them in the object store,
 * move them when reports become many.
 */
export const ekaerReport = pgTable(
  "ekaer_report",
  {
    id: id(),
    weighingId: uuid("weighing_id")
      .notNull()
      .references(() => weighing.id),
    status: text("status").$type<EkaerReportStatus>().notNull(),
    /** The weighing's ticket number; NAV is queried by it before any resend. */
    orderNumber: text("order_number").notNull(),
    tcn: text("tcn"),
    plannedKg: integer("planned_kg").notNull(),
    value: money("value").notNull(),
    requestId: text("request_id"),
    requestXml: text("request_xml"),
    responseXml: text("response_xml"),
    error: text("error"),
    deleteReason: text("delete_reason"),
    /** A person-approved weight change waiting for NAV (T-014). */
    requestedKg: integer("requested_kg"),
    changeReason: text("change_reason"),
    /** Unloading time sent with finalize. */
    arrivalAt: timestamp("arrival_at", { withTimezone: true }),
    ...audit,
  },
  (t) => [
    // At most one live report per weighing: anything not deleted or failed.
    uniqueIndex("ekaer_report_one_live_per_weighing")
      .on(t.weighingId)
      .where(sql`${t.status} not in ('deleted', 'failed')`),
    check(
      "ekaer_report_status_chk",
      sql`${t.status} in ('pending', 'active', 'modifying', 'finalizing', 'finalized', 'deleting', 'deleted', 'failed')`,
    ),
    check("ekaer_report_planned_kg_chk", sql`${t.plannedKg} > 0`),
    check("ekaer_report_value_chk", sql`${t.value} > 0`),
  ],
);

export type ShipmentStatus = "registered" | "cancelled";

/**
 * The register (PRD F4): one shipment per completed weighing, with a gapless yearly number
 * SZ-YYYY-NNNNNN. Never deleted; a voided weighing cancels its shipment and the number stays.
 * Names and net weight are copied so the register does not change when master data does.
 */
export const shipment = pgTable(
  "shipment",
  {
    id: id(),
    registryYear: integer("registry_year").notNull(),
    registrySeq: integer("registry_seq").notNull(),
    registryNumber: text("registry_number").notNull().unique(),
    weighingId: uuid("weighing_id")
      .notNull()
      .unique()
      .references(() => weighing.id),
    status: text("status").$type<ShipmentStatus>().notNull(),
    plate: text("plate").notNull(),
    customerId: uuid("customer_id").references(() => customer.id),
    productId: uuid("product_id").references(() => product.id),
    customer: text("customer").notNull(),
    product: text("product").notNull(),
    netKg: integer("net_kg").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...audit,
  },
  (t) => [
    index("shipment_shipped_at_idx").on(t.shippedAt),
    check(
      "shipment_status_chk",
      sql`${t.status} in ('registered', 'cancelled')`,
    ),
    check("shipment_net_kg_chk", sql`${t.netKg} > 0`),
  ],
);

/** Gapless SZ-YYYY-NNNNNN numbers, bumped in the transaction that registers the shipment. */
export const shipmentRegistryCounter = pgTable("shipment_registry_counter", {
  year: integer("year").primaryKey(),
  last: integer("last").notNull(),
});

/**
 * Switches the office can change (T-020), one row per key, e.g. ekaer.auto = { enabled: false }.
 * Every change is written to event_log with the person who made it.
 */
export const policy = pgTable("policy", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
