import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_guides_guide_type" AS ENUM('ultimate-guide', 'essentials', 'roundup', 'comparison');
  CREATE TYPE "public"."enum_guides_category" AS ENUM('smart-gadgets', 'toys', 'food-treats', 'health-wellness', 'grooming', 'beds-furniture', 'leashes-collars', 'travel', 'mixed', 'other');
  CREATE TYPE "public"."enum_guides_pet_type" AS ENUM('dog', 'cat', 'bird', 'fish', 'small-animal', 'reptile', 'universal');
  CREATE TYPE "public"."enum_guides_status" AS ENUM('draft', 'published');
  CREATE TABLE "guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"guide_type" "enum_guides_guide_type",
  	"summary" varchar,
  	"content" varchar,
  	"category" "enum_guides_category",
  	"pet_type" "enum_guides_pet_type",
  	"author" varchar DEFAULT 'PawLabs Team',
  	"featured_image_id" integer,
  	"published_date" timestamp(3) with time zone,
  	"status" "enum_guides_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "guides_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "guides_id" integer;
  ALTER TABLE "guides" ADD CONSTRAINT "guides_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guides_rels" ADD CONSTRAINT "guides_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "guides_rels" ADD CONSTRAINT "guides_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "guides_slug_idx" ON "guides" USING btree ("slug");
  CREATE INDEX "guides_featured_image_idx" ON "guides" USING btree ("featured_image_id");
  CREATE INDEX "guides_updated_at_idx" ON "guides" USING btree ("updated_at");
  CREATE INDEX "guides_created_at_idx" ON "guides" USING btree ("created_at");
  CREATE INDEX "guides_rels_order_idx" ON "guides_rels" USING btree ("order");
  CREATE INDEX "guides_rels_parent_idx" ON "guides_rels" USING btree ("parent_id");
  CREATE INDEX "guides_rels_path_idx" ON "guides_rels" USING btree ("path");
  CREATE INDEX "guides_rels_products_id_idx" ON "guides_rels" USING btree ("products_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guides_fk" FOREIGN KEY ("guides_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("guides_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "guides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "guides_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "guides" CASCADE;
  DROP TABLE "guides_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_guides_fk";
  
  DROP INDEX "payload_locked_documents_rels_guides_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "guides_id";
  DROP TYPE "public"."enum_guides_guide_type";
  DROP TYPE "public"."enum_guides_category";
  DROP TYPE "public"."enum_guides_pet_type";
  DROP TYPE "public"."enum_guides_status";`)
}
