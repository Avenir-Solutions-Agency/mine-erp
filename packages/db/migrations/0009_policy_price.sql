CREATE TABLE "policy" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "price_per_tonne" bigint;--> statement-breakpoint
-- Same as 0001: only the API reads this table; the Supabase Data API must not.
ALTER TABLE "policy" ENABLE ROW LEVEL SECURITY;
