ALTER TABLE "weighing" ADD COLUMN "ticket_path" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "ticket_sha256" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "void_ticket_path" text;--> statement-breakpoint
ALTER TABLE "weighing" ADD COLUMN "void_ticket_sha256" text;