import { sql } from "drizzle-orm";
import {
  bigint,
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
