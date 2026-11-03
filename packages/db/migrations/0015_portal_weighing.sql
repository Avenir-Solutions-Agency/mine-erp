CREATE TABLE "portal_weighing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"portal_id" integer NOT NULL,
	"ticket_number" text,
	"direction" text,
	"status" text NOT NULL,
	"license_plate" text,
	"trailer_plate" text,
	"customer_name" text,
	"customer_tax_number" text,
	"material_name" text,
	"gross_kg" integer,
	"tare_kg" integer,
	"net_kg" integer,
	"first_weight_kg" integer,
	"first_measured_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"driver_name" text,
	"carrier_name" text,
	"ekaer_number" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_weighing_portal_id_unique" UNIQUE("portal_id")
);
--> statement-breakpoint
CREATE INDEX "portal_weighing_completed_at_idx" ON "portal_weighing" USING btree ("completed_at");--> statement-breakpoint
-- Same as 0001: only the API reads this table; the Supabase Data API must not.
ALTER TABLE "portal_weighing" ENABLE ROW LEVEL SECURITY;
