CREATE TYPE "public"."changelog_categoria" AS ENUM('feature', 'improvement', 'bugfix', 'security');--> statement-breakpoint
CREATE TYPE "public"."changelog_prioridad" AS ENUM('critical', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "changelog_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"descartado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "changelog_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"titulo_es" text NOT NULL,
	"titulo_en" text NOT NULL,
	"categoria" "changelog_categoria" DEFAULT 'feature' NOT NULL,
	"prioridad" "changelog_prioridad" DEFAULT 'normal' NOT NULL,
	"publicado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "changelog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"texto_es" text NOT NULL,
	"texto_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentation_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre_es" text NOT NULL,
	"nombre_en" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"rol_minimo" "rol"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentation_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"titulo_es" text NOT NULL,
	"titulo_en" text NOT NULL,
	"contenido_es" text NOT NULL,
	"contenido_en" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "changelog_dismissals" ADD CONSTRAINT "changelog_dismissals_entry_id_changelog_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."changelog_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "changelog_dismissals" ADD CONSTRAINT "changelog_dismissals_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "changelog_items" ADD CONSTRAINT "changelog_items_entry_id_changelog_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."changelog_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentation_pages" ADD CONSTRAINT "documentation_pages_categoria_id_documentation_categories_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."documentation_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "changelog_dismissals_entry_usuario_unique" ON "changelog_dismissals" USING btree ("entry_id","usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "changelog_entries_version_unique" ON "changelog_entries" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documentation_categories_slug_unique" ON "documentation_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documentation_pages_categoria_slug_unique" ON "documentation_pages" USING btree ("categoria_id","slug");