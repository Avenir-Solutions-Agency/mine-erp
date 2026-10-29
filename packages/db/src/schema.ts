import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
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
  payload: jsonb("payload"),
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
    customer: text("customer"),
    material: text("material"),
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
    ...audit,
  },
  (t) => [
    index("weighing_first_at_idx").on(t.firstAt),
    index("weighing_plate_idx").on(t.plate),
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
