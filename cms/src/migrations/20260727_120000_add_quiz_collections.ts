import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Breed Match quiz schema.
 *
 * Adds two collections:
 *   - quiz_questions     — the questions, their options, and the trait weights
 *                          each option carries (nested arrays, so three tables)
 *   - quiz_submissions   — completed runs: email, answers, and what we matched
 *
 * Purely additive. `down()` removes everything it created.
 *
 * DDL was derived by pushing the current Payload schema into a scratch database
 * and dumping the result, so the column names and index names match exactly what
 * Drizzle expects at runtime.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---------------------------------------------------------------
    -- 1. Enums
    -- ---------------------------------------------------------------
    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_status" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_pet_scope" AS ENUM('both', 'dog', 'cat');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_type" AS ENUM('single', 'multi', 'text');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_layout" AS ENUM('grid', 'list', 'scale');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_options_weights_trait" AS ENUM(
        'affectionLevel',
        'childFriendly',
        'petFriendly',
        'strangerFriendly',
        'trainability',
        'energyLevel',
        'groomingNeeds',
        'sheddingLevel',
        'barkingLevel',
        'intelligence',
        'playfulness',
        'watchdogAbility',
        'adaptability',
        'healthRobustness'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_questions_options_prefers_sizes" AS ENUM('small', 'medium', 'large', 'giant');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_submissions_pet_type" AS ENUM('dog', 'cat', 'either');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_quiz_submissions_matched_by" AS ENUM('ai', 'fallback');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ---------------------------------------------------------------
    -- 2. quiz_questions
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "quiz_questions" (
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar NOT NULL,
      "helper" varchar,
      "key" varchar NOT NULL,
      "order" numeric DEFAULT 100 NOT NULL,
      "status" "enum_quiz_questions_status" DEFAULT 'draft',
      "pet_scope" "enum_quiz_questions_pet_scope" DEFAULT 'both',
      "type" "enum_quiz_questions_type" DEFAULT 'single',
      "layout" "enum_quiz_questions_layout" DEFAULT 'grid',
      "emoji" varchar,
      "required" boolean DEFAULT true,
      "max_selections" numeric,
      "placeholder" varchar,
      "source_note" varchar,
      "ai_generated" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "quiz_questions_options" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar,
      "value" varchar,
      "emoji" varchar,
      "description" varchar
    );

    CREATE TABLE IF NOT EXISTS "quiz_questions_options_weights" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "trait" "enum_quiz_questions_options_weights_trait",
      "target" numeric DEFAULT 5,
      "weight" numeric DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS "quiz_questions_options_prefers_sizes" (
      "order" integer NOT NULL,
      "parent_id" varchar NOT NULL,
      "value" "enum_quiz_questions_options_prefers_sizes",
      "id" serial PRIMARY KEY NOT NULL
    );

    -- ---------------------------------------------------------------
    -- 3. quiz_submissions
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "quiz_submissions" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar,
      "subscribed" boolean DEFAULT false,
      "pet_type" "enum_quiz_submissions_pet_type",
      "matched_by" "enum_quiz_submissions_matched_by",
      "top_breed_name" varchar,
      "note" varchar,
      "answers" jsonb,
      "result" jsonb,
      "source" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "quiz_submissions_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "breeds_id" integer
    );

    -- ---------------------------------------------------------------
    -- 4. Foreign keys
    -- ---------------------------------------------------------------
    DO $$ BEGIN
      ALTER TABLE "quiz_questions_options"
        ADD CONSTRAINT "quiz_questions_options_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_questions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "quiz_questions_options_weights"
        ADD CONSTRAINT "quiz_questions_options_weights_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_questions_options"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "quiz_questions_options_prefers_sizes"
        ADD CONSTRAINT "quiz_questions_options_prefers_sizes_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."quiz_questions_options"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "quiz_submissions_rels"
        ADD CONSTRAINT "quiz_submissions_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."quiz_submissions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "quiz_submissions_rels"
        ADD CONSTRAINT "quiz_submissions_rels_breeds_fk"
        FOREIGN KEY ("breeds_id") REFERENCES "public"."breeds"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ---------------------------------------------------------------
    -- 5. Indexes
    -- ---------------------------------------------------------------
    CREATE UNIQUE INDEX IF NOT EXISTS "quiz_questions_key_idx" ON "quiz_questions" USING btree ("key");
    CREATE INDEX IF NOT EXISTS "quiz_questions_updated_at_idx" ON "quiz_questions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "quiz_questions_created_at_idx" ON "quiz_questions" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_order_idx" ON "quiz_questions_options" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_parent_id_idx" ON "quiz_questions_options" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_weights_order_idx" ON "quiz_questions_options_weights" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_weights_parent_id_idx" ON "quiz_questions_options_weights" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_prefers_sizes_order_idx" ON "quiz_questions_options_prefers_sizes" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "quiz_questions_options_prefers_sizes_parent_idx" ON "quiz_questions_options_prefers_sizes" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_updated_at_idx" ON "quiz_submissions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_created_at_idx" ON "quiz_submissions" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_rels_order_idx" ON "quiz_submissions_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_rels_parent_idx" ON "quiz_submissions_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_rels_path_idx" ON "quiz_submissions_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "quiz_submissions_rels_breeds_id_idx" ON "quiz_submissions_rels" USING btree ("breeds_id");

    -- ---------------------------------------------------------------
    -- 6. Admin document locking needs a column per collection
    -- ---------------------------------------------------------------
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "quiz_questions_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "quiz_submissions_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_quiz_questions_fk"
        FOREIGN KEY ("quiz_questions_id") REFERENCES "public"."quiz_questions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_quiz_submissions_fk"
        FOREIGN KEY ("quiz_submissions_id") REFERENCES "public"."quiz_submissions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_quiz_questions_id_idx"
      ON "payload_locked_documents_rels" USING btree ("quiz_questions_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_quiz_submissions_id_idx"
      ON "payload_locked_documents_rels" USING btree ("quiz_submissions_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_quiz_questions_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_quiz_submissions_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_quiz_questions_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_quiz_submissions_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "quiz_questions_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "quiz_submissions_id";

    DROP TABLE IF EXISTS "quiz_questions_options_prefers_sizes" CASCADE;
    DROP TABLE IF EXISTS "quiz_questions_options_weights" CASCADE;
    DROP TABLE IF EXISTS "quiz_questions_options" CASCADE;
    DROP TABLE IF EXISTS "quiz_questions" CASCADE;
    DROP TABLE IF EXISTS "quiz_submissions_rels" CASCADE;
    DROP TABLE IF EXISTS "quiz_submissions" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_quiz_questions_status";
    DROP TYPE IF EXISTS "public"."enum_quiz_questions_pet_scope";
    DROP TYPE IF EXISTS "public"."enum_quiz_questions_type";
    DROP TYPE IF EXISTS "public"."enum_quiz_questions_layout";
    DROP TYPE IF EXISTS "public"."enum_quiz_questions_options_weights_trait";
    DROP TYPE IF EXISTS "public"."enum_quiz_questions_options_prefers_sizes";
    DROP TYPE IF EXISTS "public"."enum_quiz_submissions_pet_type";
    DROP TYPE IF EXISTS "public"."enum_quiz_submissions_matched_by";
  `)
}
