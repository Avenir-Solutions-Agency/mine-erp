CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tax_number" text,
	"address" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tax_number_unique" UNIQUE("tax_number")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"fraction_code" text,
	"vtsz" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Same as 0001: only the API reads these tables; the Supabase Data API must not.
ALTER TABLE "customer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;
