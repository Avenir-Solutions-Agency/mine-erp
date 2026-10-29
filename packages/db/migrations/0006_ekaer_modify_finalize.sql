ALTER TABLE "ekaer_report" DROP CONSTRAINT "ekaer_report_status_chk";--> statement-breakpoint
DROP INDEX "ekaer_report_one_live_per_weighing";--> statement-breakpoint
ALTER TABLE "ekaer_report" ADD COLUMN "requested_kg" integer;--> statement-breakpoint
ALTER TABLE "ekaer_report" ADD COLUMN "change_reason" text;--> statement-breakpoint
ALTER TABLE "ekaer_report" ADD COLUMN "arrival_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "ekaer_report_one_live_per_weighing" ON "ekaer_report" USING btree ("weighing_id") WHERE "ekaer_report"."status" not in ('deleted', 'failed');--> statement-breakpoint
ALTER TABLE "ekaer_report" ADD CONSTRAINT "ekaer_report_status_chk" CHECK ("ekaer_report"."status" in ('pending', 'active', 'modifying', 'finalizing', 'finalized', 'deleting', 'deleted', 'failed'));