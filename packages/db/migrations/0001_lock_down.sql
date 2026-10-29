-- Supabase exposes the public schema through its Data API to the anon and authenticated roles.
-- Only the API (secret DATABASE_URL) reads these tables, so RLS on with no policies denies everyone else.
ALTER TABLE "vehicle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incoming_invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incoming_invoice_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- event_log is append-only (ARCHITECTURE §06). The owner role keeps its rights; T-003 moves the API to a non-owner role.
REVOKE UPDATE, DELETE, TRUNCATE ON "event_log" FROM PUBLIC, anon, authenticated, service_role;
