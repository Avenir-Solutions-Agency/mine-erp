CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "incoming_invoice" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier" text,
	"supplier_tax_number" text,
	"number" text,
	"issue_date" date,
	"due_date" date,
	"payment_method" text,
	"category" text,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"net" bigint,
	"vat" bigint,
	"gross" bigint,
	"handwriting" text,
	"warning" text,
	"status" text NOT NULL,
	"cost_carrier" text,
	"file_sha256" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_mime" text NOT NULL,
	"extraction" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incoming_invoice_file_sha256_unique" UNIQUE("file_sha256")
);
--> statement-breakpoint
CREATE TABLE "incoming_invoice_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(14, 3),
	"unit" text,
	"unit_price" bigint,
	"net" bigint,
	"vat_rate" integer,
	"gross" bigint,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"make" text,
	"model" text,
	"serial_number" text,
	"year" integer,
	"note" text,
	"attributes" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plate" text NOT NULL,
	"group" text,
	"category" text,
	"make" text,
	"model" text,
	"engine_number" text,
	"power_kw" integer,
	"vin" text,
	"v9_code" text,
	"euro_class" text,
	"year" integer,
	"operator" text,
	"owner" text,
	"note" text,
	"source" text,
	"folder_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
ALTER TABLE "incoming_invoice_line" ADD CONSTRAINT "incoming_invoice_line_invoice_id_incoming_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."incoming_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incoming_invoice_issue_date_idx" ON "incoming_invoice" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "incoming_invoice_line_invoice_id_idx" ON "incoming_invoice_line" USING btree ("invoice_id");