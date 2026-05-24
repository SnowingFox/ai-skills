CREATE TABLE "page_view_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"day" date NOT NULL,
	"referrer" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "pve_day_idx" ON "page_view_event" USING btree ("day");--> statement-breakpoint
CREATE INDEX "pve_day_path_idx" ON "page_view_event" USING btree ("day","path");--> statement-breakpoint
CREATE INDEX "pve_visitor_day_idx" ON "page_view_event" USING btree ("visitor_id","day");