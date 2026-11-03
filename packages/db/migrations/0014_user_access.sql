CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"access" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- Same as 0001: only the API reads this table; the Supabase Data API must not.
ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Everyone who can sign in today keeps full access, so nobody is locked out by this release.
-- Accounts created later in Supabase without an app_user row get no access.
INSERT INTO "app_user" ("id", "email", "name", "access")
SELECT u.id, u.email, split_part(u.email, '@', 1),
  (SELECT jsonb_object_agg(m, 'write') FROM unnest(ARRAY[
    'dash','today','ai','inbox','quotes','contracts','orders','portal','dispatch','transport',
    'scale','driverapp','telem','dn','tig','billing','integr','stock','store','qr','operapp',
    'mechapp','waste','machines','reports','payroll','plan','users']) AS m)
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT DO NOTHING;
