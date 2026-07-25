import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Pivot from pet-product reviews to a dog breed encyclopedia.
 *
 * Creates the `comparisons` collection (breed-vs-breed articles, ported out of
 * the old dual-purpose `guides` collection) and drops the product/guide/review
 * side of the schema entirely.
 *
 * NOTE: this drops data irreversibly. `down()` restores the schema shape but
 * cannot restore rows — recover those from the pre-migration pg_dump in
 * .cache/pawlabs-backup-*.sql if needed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---------------------------------------------------------------
    -- 1. Enums for the new comparisons collection
    -- ---------------------------------------------------------------
    DO $$ BEGIN
      CREATE TYPE "public"."enum_comparisons_comparison_criteria_criterion" AS ENUM(
        'lowShedding',
        'apartmentFriendly',
        'watchdogAbility',
        'energyLevel',
        'trainability',
        'childFriendly',
        'petFriendly',
        'easyGrooming',
        'barkingControl',
        'adaptability',
        'intelligence',
        'healthRobustness'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_comparisons_status" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ---------------------------------------------------------------
    -- 2. comparisons
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "comparisons" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "summary" varchar,
      "content" varchar,
      "verdict" varchar,
      "author" varchar DEFAULT 'PawLabs Team',
      "featured_image_id" integer,
      "published_date" timestamp(3) with time zone,
      "status" "enum_comparisons_status" DEFAULT 'draft',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "comparisons"
        ADD CONSTRAINT "comparisons_featured_image_id_media_id_fk"
        FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "comparisons_slug_idx" ON "comparisons" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "comparisons_featured_image_idx" ON "comparisons" USING btree ("featured_image_id");
    CREATE INDEX IF NOT EXISTS "comparisons_created_at_idx" ON "comparisons" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "comparisons_updated_at_idx" ON "comparisons" USING btree ("updated_at");

    -- ---------------------------------------------------------------
    -- 3. comparisons_comparison_criteria (array field)
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "comparisons_comparison_criteria" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "criterion" "enum_comparisons_comparison_criteria_criterion" NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "comparisons_comparison_criteria"
        ADD CONSTRAINT "comparisons_comparison_criteria_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."comparisons"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "comparisons_comparison_criteria_order_idx"
      ON "comparisons_comparison_criteria" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "comparisons_comparison_criteria_parent_id_idx"
      ON "comparisons_comparison_criteria" USING btree ("_parent_id");

    -- ---------------------------------------------------------------
    -- 4. comparisons_rels (breeds relationship)
    -- ---------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "comparisons_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "breeds_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "comparisons_rels"
        ADD CONSTRAINT "comparisons_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."comparisons"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "comparisons_rels"
        ADD CONSTRAINT "comparisons_rels_breeds_fk"
        FOREIGN KEY ("breeds_id") REFERENCES "public"."breeds"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "comparisons_rels_order_idx" ON "comparisons_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "comparisons_rels_parent_idx" ON "comparisons_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "comparisons_rels_path_idx" ON "comparisons_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "comparisons_rels_breeds_id_idx" ON "comparisons_rels" USING btree ("breeds_id");

    -- ---------------------------------------------------------------
    -- 5. Point payload_locked_documents_rels at comparisons, drop the rest
    -- ---------------------------------------------------------------
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "comparisons_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_comparisons_fk"
        FOREIGN KEY ("comparisons_id") REFERENCES "public"."comparisons"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_comparisons_id_idx"
      ON "payload_locked_documents_rels" USING btree ("comparisons_id");

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "products_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reviews_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "verdicts_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "guides_id";

    -- ---------------------------------------------------------------
    -- 6. Drop the product / guide / review side of the schema
    -- ---------------------------------------------------------------
    DROP TABLE IF EXISTS "guides_comparison_criteria" CASCADE;
    DROP TABLE IF EXISTS "guides_rels" CASCADE;
    DROP TABLE IF EXISTS "guides" CASCADE;
    DROP TABLE IF EXISTS "products_pros" CASCADE;
    DROP TABLE IF EXISTS "products_cons" CASCADE;
    DROP TABLE IF EXISTS "products_gallery" CASCADE;
    DROP TABLE IF EXISTS "products" CASCADE;
    DROP TABLE IF EXISTS "reviews" CASCADE;
    DROP TABLE IF EXISTS "verdicts" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_guides_comparison_criteria_criterion";
    DROP TYPE IF EXISTS "public"."enum_guides_guide_type";
    DROP TYPE IF EXISTS "public"."enum_guides_category";
    DROP TYPE IF EXISTS "public"."enum_guides_pet_type";
    DROP TYPE IF EXISTS "public"."enum_guides_status";
    DROP TYPE IF EXISTS "public"."enum_products_category";
    DROP TYPE IF EXISTS "public"."enum_products_pet_type";
    DROP TYPE IF EXISTS "public"."enum_reviews_status";
    DROP TYPE IF EXISTS "public"."enum_reviews_verdict";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Drop the comparisons collection
    DROP TABLE IF EXISTS "comparisons_comparison_criteria" CASCADE;
    DROP TABLE IF EXISTS "comparisons_rels" CASCADE;
    DROP TABLE IF EXISTS "comparisons" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_comparisons_comparison_criteria_criterion";
    DROP TYPE IF EXISTS "public"."enum_comparisons_status";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "comparisons_id";

    -- Restore the columns the product/guide collections used. The tables they
    -- referenced are gone, so these are re-added without foreign keys; restore
    -- the tables themselves from the pre-migration pg_dump.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "products_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reviews_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "verdicts_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "guides_id" integer;
  `)
}
