CREATE TABLE "weighing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_year" integer NOT NULL,
	"ticket_seq" integer NOT NULL,
	"ticket_number" text NOT NULL,
	"status" text NOT NULL,
	"plate" text NOT NULL,
	"vehicle_id" uuid,
	"trailer_plate" text,
	"customer" text,
	"material" text,
	"note" text,
	"first_kg" integer NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"second_kg" integer,
	"second_at" timestamp with time zone,
	"gross_kg" integer,
	"tare_kg" integer,
	"net_kg" integer,
	"saved_tare" boolean DEFAULT false NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weighing_ticket_number_unique" UNIQUE("ticket_number"),
	CONSTRAINT "weighing_status_chk" CHECK ("weighing"."status" in ('open', 'completed', 'void')),
	CONSTRAINT "weighing_first_kg_chk" CHECK ("weighing"."first_kg" > 0),
	CONSTRAINT "weighing_net_chk" CHECK ("weighing"."net_kg" is null or ("weighing"."net_kg" = "weighing"."gross_kg" - "weighing"."tare_kg" and "weighing"."net_kg" > 0)),
	CONSTRAINT "weighing_completed_chk" CHECK ("weighing"."status" <> 'completed' or ("weighing"."gross_kg" is not null and "weighing"."tare_kg" is not null and "weighing"."net_kg" is not null)),
	CONSTRAINT "weighing_void_chk" CHECK ("weighing"."status" <> 'void' or ("weighing"."void_reason" is not null and "weighing"."voided_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "weighing_ticket_counter" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "tare_kg" integer;--> statement-breakpoint
ALTER TABLE "weighing" ADD CONSTRAINT "weighing_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weighing_first_at_idx" ON "weighing" USING btree ("first_at");--> statement-breakpoint
CREATE INDEX "weighing_plate_idx" ON "weighing" USING btree ("plate");--> statement-breakpoint
-- Same as 0001: only the API reads these tables; the Supabase Data API must not.
ALTER TABLE "weighing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weighing_ticket_counter" ENABLE ROW LEVEL SECURITY;
