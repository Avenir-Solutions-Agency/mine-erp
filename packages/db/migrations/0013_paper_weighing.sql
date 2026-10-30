ALTER TABLE "document" DROP CONSTRAINT "document_status_chk";--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "source" text DEFAULT 'scale' NOT NULL;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "paper_ekaer_tcn" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "delivery_note_number" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "loading_address" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "unloading_address" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_document_id_unique" UNIQUE("document_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_status_chk" CHECK ("document"."status" in ('received', 'ingested', 'extracted', 'unreadable', 'registered'));--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_source_chk" CHECK ("weighing"."source" in ('scale', 'paper'));