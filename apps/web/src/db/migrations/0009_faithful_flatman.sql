CREATE TABLE "skill" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"skill_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"installs" integer DEFAULT 0 NOT NULL,
	"weekly_installs" text,
	"is_official" boolean DEFAULT false NOT NULL,
	"markdown_content" text,
	"metadata_synced_at" timestamp DEFAULT now(),
	"markdown_synced_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "skill_installs_idx" ON "skill" USING btree ("installs");--> statement-breakpoint
CREATE INDEX "skill_source_idx" ON "skill" USING btree ("source");--> statement-breakpoint
CREATE INDEX "skill_owner_idx" ON "skill" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "skill_name_idx" ON "skill" USING btree ("name");