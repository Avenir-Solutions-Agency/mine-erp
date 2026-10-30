CREATE TABLE "document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"file_sha256" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_mime" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_file_sha256_unique" UNIQUE("file_sha256"),
	CONSTRAINT "document_status_chk" CHECK ("document"."status" in ('received', 'ingested'))
);
--> statement-breakpoint
CREATE INDEX "document_created_at_idx" ON "document" USING btree ("created_at");--> statement-breakpoint
-- Same as 0001: only the API and the worker read this table; the Supabase Data API must not.
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
