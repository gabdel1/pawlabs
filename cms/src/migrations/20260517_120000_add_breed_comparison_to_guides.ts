import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Add 'breed-comparison' to existing guide_type enum
    ALTER TYPE "public"."enum_guides_guide_type" ADD VALUE IF NOT EXISTS 'breed-comparison';

    -- 2. Add 'verdict' column to guides table
    ALTER TABLE "guides" ADD COLUMN IF NOT EXISTS "verdict" varchar;

    -- 3. Create enum for comparisonCriteria.criterion
    DO $$ BEGIN
      CREATE TYPE "public"."enum_guides_comparison_criteria_criterion" AS ENUM(
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

    -- 4. Create comparisonCriteria array table
    CREATE TABLE IF NOT EXISTS "guides_comparison_criteria" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "criterion" "enum_guides_comparison_criteria_criterion" NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "guides_comparison_criteria"
        ADD CONSTRAINT "guides_comparison_criteria_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."guides"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "guides_comparison_criteria_order_idx"
      ON "guides_comparison_criteria" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "guides_comparison_criteria_parent_id_idx"
      ON "guides_comparison_criteria" USING btree ("_parent_id");

    -- 5. Add breeds_id to guides_rels for the breeds relationship
    ALTER TABLE "guides_rels" ADD COLUMN IF NOT EXISTS "breeds_id" integer;

    DO $$ BEGIN
      ALTER TABLE "guides_rels"
        ADD CONSTRAINT "guides_rels_breeds_fk"
        FOREIGN KEY ("breeds_id") REFERENCES "public"."breeds"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "guides_rels_breeds_id_idx"
      ON "guides_rels" USING btree ("breeds_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "guides_rels" DROP CONSTRAINT IF EXISTS "guides_rels_breeds_fk";
    DROP INDEX IF EXISTS "guides_rels_breeds_id_idx";
    ALTER TABLE "guides_rels" DROP COLUMN IF EXISTS "breeds_id";

    DROP TABLE IF EXISTS "guides_comparison_criteria" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_guides_comparison_criteria_criterion";

    ALTER TABLE "guides" DROP COLUMN IF EXISTS "verdict";

    -- Note: cannot remove 'breed-comparison' value from enum_guides_guide_type
    -- without recreating the enum. Leaving the value in place on down().
  `)
}
