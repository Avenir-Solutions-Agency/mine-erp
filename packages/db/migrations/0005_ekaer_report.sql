CREATE TABLE "ekaer_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"weighing_id" uuid NOT NULL,
	"status" text NOT NULL,
	"order_number" text NOT NULL,
	"tcn" text,
	"planned_kg" integer NOT NULL,
	"value" bigint NOT NULL,
	"request_id" text,
	"request_xml" text,
	"response_xml" text,
	"error" text,
	"delete_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ekaer_report_status_chk" CHECK ("ekaer_report"."status" in ('pending', 'active', 'deleting', 'deleted', 'failed')),
	CONSTRAINT "ekaer_report_planned_kg_chk" CHECK ("ekaer_report"."planned_kg" > 0),
	CONSTRAINT "ekaer_report_value_chk" CHECK ("ekaer_report"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "ekaer_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ekaer_report" ADD CONSTRAINT "ekaer_report_weighing_id_weighing_id_fk" FOREIGN KEY ("weighing_id") REFERENCES "public"."weighing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ekaer_report_one_live_per_weighing" ON "ekaer_report" USING btree ("weighing_id") WHERE "ekaer_report"."status" in ('pending', 'active', 'deleting');--> statement-breakpoint
-- Same as 0001: only the API and worker read this table; the Supabase Data API must not.
ALTER TABLE "ekaer_report" ENABLE ROW LEVEL SECURITY;
