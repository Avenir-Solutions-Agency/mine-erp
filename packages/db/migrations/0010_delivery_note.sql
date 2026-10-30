ALTER TABLE "shipment" ADD COLUMN "delivery_note_path" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "delivery_note_sha256" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "cancelled_note_path" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "cancelled_note_sha256" text;