CREATE TYPE "public"."estado_operativo" AS ENUM('PENDIENTE', 'EN_PROCESO', 'TERMINADO', 'CARGANDO', 'LISTO_SALIDA', 'DESPACHADO', 'CANCELADO');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_estado_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"usuario_id" uuid,
	"usuario_nombre" text,
	"usuario_rol" text,
	"estado_anterior" text NOT NULL,
	"estado_nuevo" text NOT NULL,
	"observacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "estado_operativo" "estado_operativo";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_estado_log" ADD CONSTRAINT "pedido_estado_log_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_estado_log" ADD CONSTRAINT "pedido_estado_log_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
