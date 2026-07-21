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

// Condiciones oficiales por partida/SKU (distinto de CONDICIONES, que es el
// tag general del pedido). Exclusivamente estas 3 — no agregar más sin
// autorización explícita.
export const CONDICIONES_PARTIDA = ['GRA', 'GRB', 'GRC'] as const

export const UNIDADES = ['pieza', 'pallet'] as const

// ── Estado operativo (ciclo logístico) ──────────────────────────────────
// Independiente del progreso de surtido (cantidad/cantidadSurtida). Los
// primeros 3 (PENDIENTE/EN_PROCESO/TERMINADO) se derivan siempre del
// progreso; los 3 últimos (CARGANDO/LISTO_SALIDA/DESPACHADO) y CANCELADO
// solo se alcanzan por acción explícita de un admin/surtidor — nunca se
// infieren. Mismo catálogo que lib/estado-pedido.js del app Vercel.
export const ESTADOS_OPERATIVOS = [
  'PENDIENTE', 'EN_PROCESO', 'TERMINADO', 'CARGANDO', 'LISTO_SALIDA', 'DESPACHADO', 'CANCELADO',
] as const

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  TERMINADO: 'Surtido terminado',
  CARGANDO: 'Cargando',
  LISTO_SALIDA: 'Listo para salida',
  DESPACHADO: 'Despachado',
  CANCELADO: 'Cancelado',
}

// Jerarquía: un estado avanzado nunca retrocede. CANCELADO es terminal
// aparte, no entra en la jerarquía numérica.
export const ESTADO_ORDEN: Record<string, number> = {
  PENDIENTE: 0, EN_PROCESO: 1, TERMINADO: 2, CARGANDO: 3, LISTO_SALIDA: 4, DESPACHADO: 5,
}

// Estados que se fijan a mano vía PATCH /api/pedidos/:id/estado.
// PENDIENTE/EN_PROCESO/TERMINADO siempre se derivan solos del surtido.
export const ESTADOS_TRANSICION = ['CARGANDO', 'LISTO_SALIDA', 'DESPACHADO', 'CANCELADO'] as const

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
export const estadoOperativoEnum = pgEnum('estado_operativo', ESTADOS_OPERATIVOS)

// ── usuarios ────────────────────────────────────────────────────────────
// Auth híbrida: admin/capturista entran por OIDC Nextcloud (oidcSub); el
// surtidor entra por NFC o PIN en piso (pinHash con bcrypt, ya no plano
// como en lib/auth.js). Los dos dominios de correo de Nextcloud
// (@miglobal.com.mx / @mitechnologiesinc.com) se canonicalizan en
// server/auth antes de comparar contra `email` — no aquí.
// `email` es nullable (a diferencia de la Fase 1): un surtidor puede
// entrar solo con NFC/PIN sin tener email registrado — igual que en
// lib/auth.js del app original. Un índice único en Postgres permite
// múltiples NULL sin choque.
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
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
  // Etapa logística (Cargando/Listo para salida/Despachado/Cancelado).
  // NULL = todavía no hay ninguna acción de etapa; el estado visible se
  // deriva del progreso de surtido hasta que alguien lo avance a mano
  // (ver normalizeOrderStatus en client/src/lib/pedido-stats.ts).
  estadoOperativo: estadoOperativoEnum('estado_operativo'),
})

// ── pedido_estado_log ───────────────────────────────────────────────────
// Bitácora de cada cambio de etapa logística (quién, cuándo, de qué a qué,
// observación opcional — ej. la razón de un despacho con pendientes).
// Modelada igual que changelog_dismissals: FK + timestamp con default now().
export const pedidoEstadoLog = pgTable('pedido_estado_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  pedidoId: uuid('pedido_id').notNull().references(() => pedidos.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => usuarios.id),
  usuarioNombre: text('usuario_nombre'),
  usuarioRol: text('usuario_rol'),
  estadoAnterior: text('estado_anterior').notNull(),
  estadoNuevo: text('estado_nuevo').notNull(),
  observacion: text('observacion'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
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
  // Condición de ESTA partida (distinta de pedidos.condiciones, que es el tag
  // general del pedido). Dos partidas con el mismo SKU pero condición
  // distinta son líneas independientes — ver el emparejamiento en el PUT de
  // server/routes/pedidos.ts.
  condicion: text('condicion').notNull(),
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
  condicion: z.enum(CONDICIONES_PARTIDA),
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

export const duenoInputSchema = z.object({
  userId: z.string().uuid().nullable(),
})

export const estadoTransitionInputSchema = z.object({
  estado: z.enum(ESTADOS_TRANSICION),
  razon: z.string().trim().optional().nullable(),
})

// ── User Manual (gate check #11) ─────────────────────────────────────────
// Versión deliberadamente angosta del modelo de 7 tablas que describe
// apps.mi2.com.mx/stack (categories/pages/images/videos/history/views/links):
// aquí solo van categorías + páginas — cubre "categorizado, jerárquico,
// bilingüe, buscable, con permisos por rol" sin adjuntos multimedia ni
// historial de revisiones (fuera de alcance de esta fase). Contenido
// bilingüe con columnas *Es/*En en vez de filas separadas por idioma —
// más simple de mantener sincronizado.
export const documentationCategories = pgTable('documentation_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  nombreEs: text('nombre_es').notNull(),
  nombreEn: text('nombre_en').notNull(),
  orden: integer('orden').notNull().default(0),
  rolMinimo: rolEnum('rol_minimo'), // null = pública para cualquier rol logueado
}, (t) => ({
  slugUnique: uniqueIndex('documentation_categories_slug_unique').on(t.slug),
}))

export const documentationPages = pgTable('documentation_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoriaId: uuid('categoria_id').notNull().references(() => documentationCategories.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  tituloEs: text('titulo_es').notNull(),
  tituloEn: text('titulo_en').notNull(),
  contenidoEs: text('contenido_es').notNull(),
  contenidoEn: text('contenido_en').notNull(),
  orden: integer('orden').notNull().default(0),
  actualizado: timestamp('actualizado', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoriaSlugUnique: uniqueIndex('documentation_pages_categoria_slug_unique').on(t.categoriaId, t.slug),
}))

export const documentationPageInputSchema = z.object({
  categoriaId: z.string().uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'slug: solo minúsculas, números y guiones'),
  tituloEs: z.string().trim().min(1),
  tituloEn: z.string().trim().min(1),
  contenidoEs: z.string().default(''),
  contenidoEn: z.string().default(''),
  orden: z.coerce.number().int().default(0),
})

export const documentationCategoryInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'slug: solo minúsculas, números y guiones'),
  nombreEs: z.string().trim().min(1),
  nombreEn: z.string().trim().min(1),
  orden: z.coerce.number().int().default(0),
  rolMinimo: z.enum(['admin', 'capturista', 'surtidor']).nullable().optional(),
})

// ── Changelog (gate check #12) ────────────────────────────────────────────
export const changelogCategoriaEnum = pgEnum('changelog_categoria', ['feature', 'improvement', 'bugfix', 'security'])
export const changelogPrioridadEnum = pgEnum('changelog_prioridad', ['critical', 'high', 'normal', 'low'])

export const changelogEntries = pgTable('changelog_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: text('version').notNull(),
  tituloEs: text('titulo_es').notNull(),
  tituloEn: text('titulo_en').notNull(),
  categoria: changelogCategoriaEnum('categoria').notNull().default('feature'),
  prioridad: changelogPrioridadEnum('prioridad').notNull().default('normal'),
  publicadoEn: timestamp('publicado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  versionUnique: uniqueIndex('changelog_entries_version_unique').on(t.version),
}))

export const changelogItems = pgTable('changelog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull().references(() => changelogEntries.id, { onDelete: 'cascade' }),
  orden: integer('orden').notNull().default(0),
  textoEs: text('texto_es').notNull(),
  textoEn: text('texto_en').notNull(),
})

export const changelogDismissals = pgTable('changelog_dismissals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull().references(() => changelogEntries.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  descartadoEn: timestamp('descartado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entryUsuarioUnique: uniqueIndex('changelog_dismissals_entry_usuario_unique').on(t.entryId, t.usuarioId),
}))

export const changelogEntryInputSchema = z.object({
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, 'usa semver: x.y.z'),
  tituloEs: z.string().trim().min(1),
  tituloEn: z.string().trim().min(1),
  categoria: z.enum(['feature', 'improvement', 'bugfix', 'security']),
  prioridad: z.enum(['critical', 'high', 'normal', 'low']),
  items: z.array(z.object({ textoEs: z.string().trim().min(1), textoEn: z.string().trim().min(1) })).default([]),
})

// ── Tipos ───────────────────────────────────────────────────────────────
export type Usuario = z.infer<typeof selectUsuarioSchema>
export type Rol = (typeof rolEnum.enumValues)[number]
export type TelevisionInput = z.infer<typeof televisionInputSchema>
export type PedidoInput = z.infer<typeof pedidoInputSchema>
export type TelevisionRow = typeof pedidoTelevisiones.$inferSelect
// $inferSelect (no el Zod derivado de selectPedidoSchema) porque drizzle-zod
// tipa las columnas `text().array()` como string simple, no string[] — ver
// `condiciones`/`modelosAlternativos`.
export type Pedido = typeof pedidos.$inferSelect

// Forma "pedido + televisiones" tal como la consume el cliente (equivalente
// al documento Mongo original, para minimizar cambios en la UI portada).
export type PedidoConTvs = Pedido & { televisiones: TelevisionRow[] }

export type PedidoEstadoLogRow = typeof pedidoEstadoLog.$inferSelect
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number]

export type DocumentationCategory = typeof documentationCategories.$inferSelect
export type DocumentationPage = typeof documentationPages.$inferSelect
export type ChangelogEntry = typeof changelogEntries.$inferSelect
export type ChangelogItem = typeof changelogItems.$inferSelect
