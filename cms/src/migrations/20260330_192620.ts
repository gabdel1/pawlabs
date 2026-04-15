import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_breeds_pet_type" AS ENUM('dog', 'cat');
  CREATE TYPE "public"."enum_breeds_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_breeds_breed_group" AS ENUM('sporting', 'working', 'herding', 'toy', 'terrier', 'hound', 'non-sporting', 'foundation-stock', 'natural', 'hybrid', 'mutation', 'crossbreed');
  CREATE TYPE "public"."enum_breeds_size" AS ENUM('small', 'medium', 'large', 'giant');
  CREATE TYPE "public"."enum_breeds_coat_type" AS ENUM('smooth', 'double', 'wire', 'curly', 'silky', 'hairless', 'long', 'short', 'medium', 'rough');
  CREATE TYPE "public"."enum_breeds_coat_length" AS ENUM('short', 'medium', 'long', 'hairless');
  CREATE TABLE "breeds_colors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"color" varchar NOT NULL
  );
  
  CREATE TABLE "breeds_temperament" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"trait" varchar NOT NULL
  );
  
  CREATE TABLE "breeds_strengths" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );
  
  CREATE TABLE "breeds_weaknesses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );
  
  CREATE TABLE "breeds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"pet_type" "enum_breeds_pet_type" NOT NULL,
  	"status" "enum_breeds_status" DEFAULT 'draft',
  	"featured" boolean DEFAULT false,
  	"image_id" integer,
  	"short_description" varchar,
  	"breed_group" "enum_breeds_breed_group",
  	"size" "enum_breeds_size",
  	"height_min" numeric,
  	"height_max" numeric,
  	"weight_min" numeric,
  	"weight_max" numeric,
  	"life_expectancy_min" numeric,
  	"life_expectancy_max" numeric,
  	"coat_type" "enum_breeds_coat_type",
  	"coat_length" "enum_breeds_coat_length",
  	"origin" varchar,
  	"breed_role" varchar,
  	"traits_affection_level" numeric,
  	"traits_child_friendly" numeric,
  	"traits_pet_friendly" numeric,
  	"traits_stranger_friendly" numeric,
  	"traits_trainability" numeric,
  	"traits_energy_level" numeric,
  	"traits_grooming_needs" numeric,
  	"traits_shedding_level" numeric,
  	"traits_barking_level" numeric,
  	"traits_intelligence" numeric,
  	"traits_playfulness" numeric,
  	"traits_watchdog_ability" numeric,
  	"traits_adaptability" numeric,
  	"traits_health_robustness" numeric,
  	"breed_history" varchar,
  	"article" varchar,
  	"author" varchar DEFAULT 'PawLabs Team',
  	"published_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "breeds_id" integer;
  ALTER TABLE "breeds_colors" ADD CONSTRAINT "breeds_colors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."breeds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "breeds_temperament" ADD CONSTRAINT "breeds_temperament_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."breeds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "breeds_strengths" ADD CONSTRAINT "breeds_strengths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."breeds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "breeds_weaknesses" ADD CONSTRAINT "breeds_weaknesses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."breeds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "breeds" ADD CONSTRAINT "breeds_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "breeds_colors_order_idx" ON "breeds_colors" USING btree ("_order");
  CREATE INDEX "breeds_colors_parent_id_idx" ON "breeds_colors" USING btree ("_parent_id");
  CREATE INDEX "breeds_temperament_order_idx" ON "breeds_temperament" USING btree ("_order");
  CREATE INDEX "breeds_temperament_parent_id_idx" ON "breeds_temperament" USING btree ("_parent_id");
  CREATE INDEX "breeds_strengths_order_idx" ON "breeds_strengths" USING btree ("_order");
  CREATE INDEX "breeds_strengths_parent_id_idx" ON "breeds_strengths" USING btree ("_parent_id");
  CREATE INDEX "breeds_weaknesses_order_idx" ON "breeds_weaknesses" USING btree ("_order");
  CREATE INDEX "breeds_weaknesses_parent_id_idx" ON "breeds_weaknesses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "breeds_slug_idx" ON "breeds" USING btree ("slug");
  CREATE INDEX "breeds_image_idx" ON "breeds" USING btree ("image_id");
  CREATE INDEX "breeds_updated_at_idx" ON "breeds" USING btree ("updated_at");
  CREATE INDEX "breeds_created_at_idx" ON "breeds" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_breeds_fk" FOREIGN KEY ("breeds_id") REFERENCES "public"."breeds"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_breeds_id_idx" ON "payload_locked_documents_rels" USING btree ("breeds_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "breeds_colors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "breeds_temperament" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "breeds_strengths" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "breeds_weaknesses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "breeds" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "breeds_colors" CASCADE;
  DROP TABLE "breeds_temperament" CASCADE;
  DROP TABLE "breeds_strengths" CASCADE;
  DROP TABLE "breeds_weaknesses" CASCADE;
  DROP TABLE "breeds" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_breeds_fk";
  
  DROP INDEX "payload_locked_documents_rels_breeds_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "breeds_id";
  DROP TYPE "public"."enum_breeds_pet_type";
  DROP TYPE "public"."enum_breeds_status";
  DROP TYPE "public"."enum_breeds_breed_group";
  DROP TYPE "public"."enum_breeds_size";
  DROP TYPE "public"."enum_breeds_coat_type";
  DROP TYPE "public"."enum_breeds_coat_length";`)
}
