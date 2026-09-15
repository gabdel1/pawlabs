import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Content plan — the editorial calendar the daily generator works through.
 *
 * Purely additive. DDL derived by pushing the current Payload schema into a
 * scratch database and dumping it, so names match what Drizzle expects at
 * runtime (see COMMANDS.md → Database Migrations for the recipe).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_content_plan_style" AS ENUM('head-to-head', 'three-way', 'best-for', 'group-roundup');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_content_plan_status" AS ENUM('queued', 'generated', 'skipped', 'failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "content_plan" (
      "id" serial PRIMARY KEY NOT NULL,
      "working_title" varchar NOT NULL,
      "style" "enum_content_plan_style" NOT NULL,
      "status" "enum_content_plan_status" DEFAULT 'queued',
      "scheduled_for" timestamp(3) with time zone,
      "score" numeric,
      "angle_key" varchar,
      "breed_group" varchar,
      "criteria" jsonb,
      "reason" varchar,
      "generated_article_id" integer,
      "last_error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "content_plan_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "breeds_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "content_plan"
        ADD CONSTRAINT "content_plan_generated_article_id_comparisons_id_fk"
        FOREIGN KEY ("generated_article_id") REFERENCES "public"."comparisons"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "content_plan_rels"
        ADD CONSTRAINT "content_plan_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."content_plan"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "content_plan_rels"
        ADD CONSTRAINT "content_plan_rels_breeds_fk"
        FOREIGN KEY ("breeds_id") REFERENCES "public"."breeds"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "content_plan_generated_article_idx" ON "content_plan" USING btree ("generated_article_id");
    CREATE INDEX IF NOT EXISTS "content_plan_updated_at_idx" ON "content_plan" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "content_plan_created_at_idx" ON "content_plan" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "content_plan_rels_order_idx" ON "content_plan_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "content_plan_rels_parent_idx" ON "content_plan_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "content_plan_rels_path_idx" ON "content_plan_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "content_plan_rels_breeds_id_idx" ON "content_plan_rels" USING btree ("breeds_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "content_plan_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_content_plan_fk"
        FOREIGN KEY ("content_plan_id") REFERENCES "public"."content_plan"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_content_plan_id_idx"
      ON "payload_locked_documents_rels" USING btree ("content_plan_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_content_plan_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_content_plan_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_plan_id";

    DROP TABLE IF EXISTS "content_plan_rels" CASCADE;
    DROP TABLE IF EXISTS "content_plan" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_content_plan_style";
    DROP TYPE IF EXISTS "public"."enum_content_plan_status";
  `)
}
