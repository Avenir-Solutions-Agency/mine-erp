CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"registry_year" integer NOT NULL,
	"registry_seq" integer NOT NULL,
	"registry_number" text NOT NULL,
	"weighing_id" uuid NOT NULL,
	"status" text NOT NULL,
	"plate" text NOT NULL,
	"customer_id" uuid,
	"product_id" uuid,
	"customer" text NOT NULL,
	"product" text NOT NULL,
	"net_kg" integer NOT NULL,
	"shipped_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_registry_number_unique" UNIQUE("registry_number"),
	CONSTRAINT "shipment_weighing_id_unique" UNIQUE("weighing_id"),
	CONSTRAINT "shipment_status_chk" CHECK ("shipment"."status" in ('registered', 'cancelled')),
	CONSTRAINT "shipment_net_kg_chk" CHECK ("shipment"."net_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_registry_counter" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_weighing_id_weighing_id_fk" FOREIGN KEY ("weighing_id") REFERENCES "public"."weighing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_shipped_at_idx" ON "shipment" USING btree ("shipped_at");--> statement-breakpoint
-- Same as 0001: only the API and worker read these tables; the Supabase Data API must not.
ALTER TABLE "shipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shipment_registry_counter" ENABLE ROW LEVEL SECURITY;
