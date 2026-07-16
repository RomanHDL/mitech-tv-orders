// Esquema Drizzle + Zod compartido entre client y server.
// Reemplaza las colecciones Mongo `pedidos` / `usuarios` / `catalogo_onn`
// (ver lib/mongodb.js, lib/auth.js, lib/catalogos.js del app original) por
// tablas Postgres normalizadas. Arranque limpio: sin migración de datos,
// solo catálogos y usuarios semilla (ver server/seed.ts).
import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// ── Catálogos (antes lib/catalogos.js) ─────────────────────────────────────
// Se mantienen como constantes TS (no tablas) porque son listas cerradas que
// solo un admin cambia editando código — igual que en el app original.
export const MARCAS = [
  'Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Sharp', 'Vizio',
  'Panasonic', 'ONN', 'Roku TV', 'Westinghouse', 'Insignia', 'Element',
  'Sceptre', 'JVC', 'Aiwa', 'RCA', 'Toshiba', 'Hitachi', 'Skyworth',
  'Polaroid', 'Hyundai', 'Daewoo', 'Konka', 'Chiq', 'Blaupunkt', 'Grundig',
] as const

export const PULGADAS = [24, 32, 40, 43, 50, 55, 58, 60, 65, 70, 75, 85, 86, 98, 100] as const

export const CONDICIONES = [
  'GRA', 'GRB', 'GRC',
  'ICB', 'ICC', 'ICD', 'ICX',
  'BOX', 'DNP', 'DMT', 'DMA',
] as const

export const UNIDADES = ['pieza', 'pallet'] as const

export const SKU_REGEX = /^[A-Za-z0-9]{3,20}$/

export function skuValido(sku: string) {
  return typeof sku === 'string' && SKU_REGEX.test(sku)
}

export function unidadLabel(cantidad: number, unidad: string, mayuscula = false) {
  let label: string
  if (unidad === 'pallet') {
    label = cantidad === 1 ? 'pallet' : 'pallets'
  } else {
    label = cantidad === 1 ? 'pieza' : 'piezas'
  }
  return mayuscula ? label.toUpperCase() : label
}

// ── Enums ───────────────────────────────────────────────────────────────
export const rolEnum = pgEnum('rol', ['admin', 'capturista', 'surtidor'])
export const unidadEnum = pgEnum('unidad', UNIDADES)

// ── usuarios ────────────────────────────────────────────────────────────
// Auth híbrida: admin/capturista entran por OIDC Nextcloud (oidcSub); el
// surtidor entra por NFC o PIN en piso (pinHash con bcrypt, ya no plano
// como en lib/auth.js). Los dos dominios de correo de Nextcloud
// (@miglobal.com.mx / @mitechnologiesinc.com) se canonicalizan en
// server/auth antes de comparar contra `email` — no aquí.
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  oidcSub: text('oidc_sub'),
  nfcUid: text('nfc_uid'),
  pinHash: text('pin_hash'),
  creado: timestamp('creado', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: uniqueIndex('usuarios_email_unique').on(t.email),
  nfcUidUnique: uniqueIndex('usuarios_nfc_uid_unique').on(t.nfcUid),
}))

// ── pedidos ─────────────────────────────────────────────────────────────
export const pedidos = pgTable('pedidos', {
  id: uuid('id').primaryKey().defaultRandom(),
  numeroPedido: text('numero_pedido').notNull(),
  pedidoNombre: text('pedido_nombre').notNull(),
  condiciones: text('condiciones').array().notNull().default(sql`'{}'::text[]`),
  cantidadTotal: integer('cantidad_total'),
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  fechaLimite: date('fecha_limite').notNull(),
  comentarios: text('comentarios'),
  comentariosActualizado: timestamp('comentarios_actualizado', { withTimezone: true }),
  comentariosActualizadoPor: uuid('comentarios_actualizado_por').references(() => usuarios.id),
  comentariosActualizadoPorNombre: text('comentarios_actualizado_por_nombre'),
  creadoPor: uuid('creado_por').references(() => usuarios.id),
  creadoPorNombre: text('creado_por_nombre'),
  creadoPorRol: text('creado_por_rol'),
})

// ── pedido_televisiones ─────────────────────────────────────────────────
// Antes era el array embebido `televisiones` dentro del documento Mongo.
// `orden` preserva el índice del array (usado por el módulo de surtido,
// que antes indexaba por tvIndex; ahora referencia por id de fila).
export const pedidoTelevisiones = pgTable('pedido_televisiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  pedidoId: uuid('pedido_id').notNull().references(() => pedidos.id, { onDelete: 'cascade' }),
  orden: integer('orden').notNull(),
  marca: text('marca').notNull(),
  pulgadas: integer('pulgadas').notNull(),
  modelo: text('modelo').notNull(),
  modelosAlternativos: text('modelos_alternativos').array().notNull().default(sql`'{}'::text[]`),
  cantidad: integer('cantidad').notNull().default(0),
  unidad: unidadEnum('unidad').notNull().default('pieza'),
  sinLimite: boolean('sin_limite').notNull().default(false),
  cantidadSurtida: integer('cantidad_surtida').notNull().default(0),
})

// ── catalogo_onn ────────────────────────────────────────────────────────
export const catalogoOnn = pgTable('catalogo_onn', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelo: text('modelo').notNull(),
  pulgadas: integer('pulgadas').notNull(),
  actualizado: timestamp('actualizado', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  modeloUnique: uniqueIndex('catalogo_onn_modelo_unique').on(t.modelo),
}))

// ── Zod: select/insert derivados + validación de dominio ────────────────
// Nota: la normalización de email (lowercase) y nfcUid (uppercase) se hace
// en el código de servidor que usa este schema (server/auth, server/routes),
// no aquí — createInsertSchema solo deriva la forma de columnas.
export const selectUsuarioSchema = createSelectSchema(usuarios)
export const insertUsuarioSchema = createInsertSchema(usuarios)

export const selectPedidoSchema = createSelectSchema(pedidos)

export const televisionInputSchema = z.object({
  marca: z.enum(MARCAS as unknown as [string, ...string[]]),
  pulgadas: z.coerce.number().refine((n) => (PULGADAS as readonly number[]).includes(n), {
    message: 'pulgadas inválidas',
  }),
  modelo: z.string().trim().toUpperCase().regex(SKU_REGEX, 'captura el modelo / SKU (mín. 3 letras o números)'),
  modelosAlternativos: z.array(z.string().trim().toUpperCase().regex(SKU_REGEX)).default([]),
  cantidad: z.coerce.number().int().min(0).default(0),
  unidad: z.enum(UNIDADES).default('pieza'),
  sinLimite: z.boolean().default(false),
})

export const pedidoInputSchema = z.object({
  numeroPedido: z.string().trim().min(1, 'Número de pedido requerido'),
  pedidoNombre: z.string().trim().min(1, 'Nombre de pedido requerido'),
  condiciones: z.array(z.enum(CONDICIONES as unknown as [string, ...string[]])),
  cantidadTotal: z.coerce.number().int().min(1).nullable().optional(),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha límite requerida'),
  televisiones: z.array(televisionInputSchema).min(1, 'Agrega al menos una televisión'),
}).refine(
  (data) => {
    if (data.cantidadTotal == null) return true
    const suma = data.televisiones.reduce((s, tv) => s + (tv.sinLimite ? 0 : tv.cantidad), 0)
    return suma <= data.cantidadTotal
  },
  { message: 'La suma de cantidades excede la cantidad total del pedido', path: ['cantidadTotal'] }
)

export const surtidoInputSchema = z.object({
  cantidadSurtida: z.coerce.number().int().min(0),
})

export const comentarioInputSchema = z.object({
  comentarios: z.string().max(2000).default(''),
})

export const catalogoOnnInputSchema = z.object({
  modelo: z.string().trim().toUpperCase().min(1),
  pulgadas: z.coerce.number().refine((n) => (PULGADAS as readonly number[]).includes(n)),
})

// ── Tipos ───────────────────────────────────────────────────────────────
export type Usuario = z.infer<typeof selectUsuarioSchema>
export type Rol = (typeof rolEnum.enumValues)[number]
export type Pedido = z.infer<typeof selectPedidoSchema>
export type TelevisionInput = z.infer<typeof televisionInputSchema>
export type PedidoInput = z.infer<typeof pedidoInputSchema>

// Forma "pedido + televisiones" tal como la consume el cliente (equivalente
// al documento Mongo original, para minimizar cambios en la UI portada).
export type PedidoConTvs = Pedido & { televisiones: (typeof pedidoTelevisiones.$inferSelect)[] }
