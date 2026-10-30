CREATE TABLE "extraction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"result" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" DROP CONSTRAINT "document_status_chk";--> statement-breakpoint
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_document_prompt_uq" ON "extraction" USING btree ("document_id","prompt_version");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_status_chk" CHECK ("document"."status" in ('received', 'ingested', 'extracted', 'unreadable'));--> statement-breakpoint
-- Same as 0001: only the API and the worker read this table; the Supabase Data API must not.
ALTER TABLE "extraction" ENABLE ROW LEVEL SECURITY;
