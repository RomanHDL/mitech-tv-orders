// Núcleo de pedidos: CRUD + surtido por línea + comentarios + reasignación
// de dueño. Reemplaza app/api/pedidos/**/route.js (Mongo, array embebido)
// por Drizzle sobre `pedidos` + `pedido_televisiones` normalizadas.
import { Router, type Express } from 'express'
import { eq, desc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { pedidos, pedidoTelevisiones, usuarios, pedidoInputSchema, surtidoInputSchema, comentarioInputSchema, duenoInputSchema, type PedidoConTvs } from '../../shared/schema'
import { requireUser, requireRole, getUsuario } from '../middleware/auth'

const router = Router()

async function obtenerPedidoConTvs(id: string): Promise<PedidoConTvs | null> {
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, id))
  if (!pedido) return null
  const televisiones = await db
    .select()
    .from(pedidoTelevisiones)
    .where(eq(pedidoTelevisiones.pedidoId, id))
    .orderBy(pedidoTelevisiones.orden)
  return { ...pedido, televisiones }
}

// Junta pedidos + sus televisiones en una sola pasada (evita N+1). `filas`
// ya viene ordenada/filtrada por el caller (lista completa vs. cola de
// surtir con ownership).
async function juntarConTvs(filas: (typeof pedidos.$inferSelect)[]): Promise<PedidoConTvs[]> {
  if (filas.length === 0) return []
  const ids = filas.map((p) => p.id)
  const tvs = await db.select().from(pedidoTelevisiones).where(inArray(pedidoTelevisiones.pedidoId, ids))
  const tvsPorPedido = new Map<string, typeof tvs>()
  for (const tv of tvs) {
    const lista = tvsPorPedido.get(tv.pedidoId) || []
    lista.push(tv)
    tvsPorPedido.set(tv.pedidoId, lista)
  }
  return filas.map((p) => ({
    ...p,
    televisiones: (tvsPorPedido.get(p.id) || []).sort((a, b) => a.orden - b.orden),
  }))
}

// ── GET /api/pedidos — lista completa (admin/capturista) ─────────────────
// Sin filtro de dueño: en /pedidos ambos roles ven todos los pedidos (el
// <select> de dueño es justamente para reasignar). Distinto del filtro de
// /api/surtir (ver abajo), que sí acota a capturista a lo suyo.
router.get('/api/pedidos', requireRole('admin', 'capturista'), async (_req, res) => {
  const filas = await db.select().from(pedidos).orderBy(desc(pedidos.fecha)).limit(100)
  res.json(await juntarConTvs(filas))
})

// ── GET /api/surtir — cola de surtido + historial (admin/capturista/surtidor) ──
// admin y surtidor ven todo; capturista solo lo suyo — mismo filtro que
// app/surtir/page.jsx y app/historial/page.jsx del original (ambas páginas
// leían de esta misma regla, por eso comparten un único endpoint aquí).
router.get('/api/surtir', requireRole('admin', 'capturista', 'surtidor'), async (req, res) => {
  const usuario = getUsuario(req)!
  const filas =
    usuario.rol === 'capturista'
      ? await db.select().from(pedidos).where(eq(pedidos.creadoPor, usuario.id)).orderBy(desc(pedidos.fecha)).limit(200)
      : await db.select().from(pedidos).orderBy(desc(pedidos.fecha)).limit(200)
  res.json(await juntarConTvs(filas))
})

// Usuarios asignables como dueño de un pedido (admin/capturista) — usado
// por el <select> de dueño en la lista. El CRUD completo de usuarios vive
// en server/routes/usuarios.ts (Fase 7); este endpoint es intencionalmente
// angosto (solo id/nombre/rol) y se queda aquí porque es pedidos quien lo
// consume.
router.get('/api/usuarios/asignables', requireRole('admin'), async (_req, res) => {
  const filas = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, rol: usuarios.rol })
    .from(usuarios)
    .where(inArray(usuarios.rol, ['admin', 'capturista']))
    .orderBy(usuarios.nombre)
  res.json(filas)
})

// ── POST /api/pedidos — crear (admin/capturista) ─────────────────────────
router.post('/api/pedidos', requireRole('admin', 'capturista'), async (req, res) => {
  const parsed = pedidoInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  }
  const usuario = getUsuario(req)!
  const { televisiones, ...datosPedido } = parsed.data

  const [pedido] = await db
    .insert(pedidos)
    .values({
      ...datosPedido,
      cantidadTotal: datosPedido.cantidadTotal ?? null,
      creadoPor: usuario.id,
      creadoPorNombre: usuario.nombre,
      creadoPorRol: usuario.rol,
    })
    .returning()

  await db.insert(pedidoTelevisiones).values(
    televisiones.map((tv, orden) => ({
      pedidoId: pedido.id,
      orden,
      marca: tv.marca,
      pulgadas: tv.pulgadas,
      modelo: tv.modelo,
      modelosAlternativos: tv.modelosAlternativos,
      cantidad: tv.sinLimite ? 0 : tv.cantidad,
      unidad: tv.unidad,
      sinLimite: tv.sinLimite,
      cantidadSurtida: 0,
    }))
  )

  res.status(201).json({ id: pedido.id })
})

// ── GET /api/pedidos/:id — cualquier rol logueado ────────────────────────
router.get('/api/pedidos/:id', requireUser, async (req, res) => {
  const pedido = await obtenerPedidoConTvs(req.params.id)
  if (!pedido) return res.status(404).json({ error: 'No encontrado' })
  res.json(pedido)
})

// ── PUT /api/pedidos/:id — edición completa (admin) ──────────────────────
// Preserva cantidadSurtida cuando el TV (marca, pulgadas, modelo, unidad)
// sigue existiendo en la nueva versión — mismo criterio que el PUT original.
router.put('/api/pedidos/:id', requireRole('admin'), async (req, res) => {
  const parsed = pedidoInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  }
  const existente = await obtenerPedidoConTvs(req.params.id)
  if (!existente) return res.status(404).json({ error: 'Pedido no encontrado' })

  const { televisiones, ...datosPedido } = parsed.data

  await db
    .update(pedidos)
    .set({ ...datosPedido, cantidadTotal: datosPedido.cantidadTotal ?? null })
    .where(eq(pedidos.id, req.params.id))

  await db.delete(pedidoTelevisiones).where(eq(pedidoTelevisiones.pedidoId, req.params.id))
  await db.insert(pedidoTelevisiones).values(
    televisiones.map((tv, orden) => {
      const cantidadFinal = tv.sinLimite ? 0 : tv.cantidad
      const match = existente.televisiones.find(
        (v) => v.marca === tv.marca && v.pulgadas === tv.pulgadas && v.modelo === tv.modelo && v.unidad === tv.unidad
      )
      const cantidadSurtida = match
        ? tv.sinLimite
          ? match.cantidadSurtida
          : Math.min(cantidadFinal, match.cantidadSurtida)
        : 0
      return {
        pedidoId: req.params.id,
        orden,
        marca: tv.marca,
        pulgadas: tv.pulgadas,
        modelo: tv.modelo,
        modelosAlternativos: tv.modelosAlternativos,
        cantidad: cantidadFinal,
        unidad: tv.unidad,
        sinLimite: tv.sinLimite,
        cantidadSurtida,
      }
    })
  )

  res.json({ ok: true })
})

// ── DELETE /api/pedidos/:id — admin ──────────────────────────────────────
router.delete('/api/pedidos/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(pedidos).where(eq(pedidos.id, req.params.id)).returning({ id: pedidos.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// ── PATCH /api/pedidos/:id/televisiones/:tvId — surtido ──────────────────
// Reemplaza el PATCH por tvIndex del original (array embebido) por id de
// fila. admin: cualquier pedido. capturista: solo el suyo. surtidor: cualquiera.
router.patch(
  '/api/pedidos/:id/televisiones/:tvId',
  requireRole('admin', 'capturista', 'surtidor'),
  async (req, res) => {
    const parsed = surtidoInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'cantidadSurtida inválida' })
    }

    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, req.params.id))
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' })

    const usuario = getUsuario(req)!
    if (usuario.rol === 'capturista' && pedido.creadoPor !== usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const [tv] = await db
      .select()
      .from(pedidoTelevisiones)
      .where(eq(pedidoTelevisiones.id, req.params.tvId))
    if (!tv || tv.pedidoId !== req.params.id) {
      return res.status(400).json({ error: 'TV no existe en el pedido' })
    }
    if (!tv.sinLimite && parsed.data.cantidadSurtida > tv.cantidad) {
      return res.status(400).json({ error: 'No se puede surtir más que la cantidad pedida' })
    }

    await db
      .update(pedidoTelevisiones)
      .set({ cantidadSurtida: parsed.data.cantidadSurtida })
      .where(eq(pedidoTelevisiones.id, req.params.tvId))

    res.json({ ok: true })
  }
)

// ── PATCH /api/pedidos/:id/comentarios ───────────────────────────────────
// El original restringía esto a admin por un desalineamiento entre
// middleware.js (bloqueaba el subpath a capturista/surtidor) y el propio
// handler (que ya traía el chequeo de ownership de capturista, pensado
// para permitirle acceso). Aquí se permite a los tres roles, como el
// handler siempre dio a entender que debía ser.
router.patch('/api/pedidos/:id/comentarios', requireRole('admin', 'capturista', 'surtidor'), async (req, res) => {
  const parsed = comentarioInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Comentario inválido' })
  }

  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, req.params.id))
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' })

  const usuario = getUsuario(req)!
  if (usuario.rol === 'capturista' && pedido.creadoPor !== usuario.id) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const comentarios = parsed.data.comentarios.slice(0, 2000)
  const ahora = new Date()
  await db
    .update(pedidos)
    .set({
      comentarios,
      comentariosActualizado: ahora,
      comentariosActualizadoPor: usuario.id,
      comentariosActualizadoPorNombre: usuario.nombre,
    })
    .where(eq(pedidos.id, req.params.id))

  res.json({
    ok: true,
    comentarios,
    actualizado: ahora.toISOString(),
    actualizadoPorNombre: usuario.nombre,
  })
})

// ── PATCH /api/pedidos/:id/dueno — reasignar dueño (admin) ───────────────
router.patch('/api/pedidos/:id/dueno', requireRole('admin'), async (req, res) => {
  const parsed = duenoInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'userId inválido' })

  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, req.params.id))
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' })

  if (parsed.data.userId === null) {
    await db
      .update(pedidos)
      .set({ creadoPor: null, creadoPorNombre: null, creadoPorRol: null })
      .where(eq(pedidos.id, req.params.id))
    return res.json({ ok: true })
  }

  const [nuevoDueno] = await db.select().from(usuarios).where(eq(usuarios.id, parsed.data.userId))
  if (!nuevoDueno) return res.status(400).json({ error: 'Usuario no encontrado' })

  await db
    .update(pedidos)
    .set({ creadoPor: nuevoDueno.id, creadoPorNombre: nuevoDueno.nombre, creadoPorRol: nuevoDueno.rol })
    .where(eq(pedidos.id, req.params.id))
  res.json({ ok: true })
})

export function registerPedidosRoutes(app: Express) {
  app.use(router)
}
