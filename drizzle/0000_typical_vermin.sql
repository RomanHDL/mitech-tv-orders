CREATE TYPE "public"."rol" AS ENUM('admin', 'capturista', 'surtidor');--> statement-breakpoint
CREATE TYPE "public"."unidad" AS ENUM('pieza', 'pallet');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_onn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo" text NOT NULL,
	"pulgadas" integer NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_televisiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"marca" text NOT NULL,
	"pulgadas" integer NOT NULL,
	"modelo" text NOT NULL,
	"modelos_alternativos" text[] DEFAULT '{}'::text[] NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"unidad" "unidad" DEFAULT 'pieza' NOT NULL,
	"sin_limite" boolean DEFAULT false NOT NULL,
	"cantidad_surtida" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_pedido" text NOT NULL,
	"pedido_nombre" text NOT NULL,
	"condiciones" text[] DEFAULT '{}'::text[] NOT NULL,
	"cantidad_total" integer,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_limite" date NOT NULL,
	"comentarios" text,
	"comentarios_actualizado" timestamp with time zone,
	"comentarios_actualizado_por" uuid,
	"comentarios_actualizado_por_nombre" text,
	"creado_por" uuid,
	"creado_por_nombre" text,
	"creado_por_rol" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" NOT NULL,
	"oidc_sub" text,
	"nfc_uid" text,
	"pin_hash" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_televisiones" ADD CONSTRAINT "pedido_televisiones_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comentarios_actualizado_por_usuarios_id_fk" FOREIGN KEY ("comentarios_actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalogo_onn_modelo_unique" ON "catalogo_onn" USING btree ("modelo");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_unique" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_nfc_uid_unique" ON "usuarios" USING btree ("nfc_uid");