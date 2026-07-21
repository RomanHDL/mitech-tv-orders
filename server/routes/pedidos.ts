// Núcleo de pedidos: CRUD + surtido por línea + comentarios + reasignación
// de dueño. Reemplaza app/api/pedidos/**/route.js (Mongo, array embebido)
// por Drizzle sobre `pedidos` + `pedido_televisiones` normalizadas.
import { Router, type Express } from 'express'
import { eq, desc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import {
  pedidos,
  pedidoTelevisiones,
  pedidoEstadoLog,
  usuarios,
  pedidoInputSchema,
  surtidoInputSchema,
  comentarioInputSchema,
  duenoInputSchema,
  estadoTransitionInputSchema,
  ESTADO_ORDEN,
  ESTADO_LABEL,
  type PedidoConTvs,
  type PedidoEstadoLogRow,
  type EstadoOperativo,
} from '../../shared/schema'
import { requireUser, requireRole, getUsuario } from '../middleware/auth'

// GET /api/pedidos/:id trae también la bitácora de cambios de etapa (el
// modal de detalle la muestra debajo del stepper) — se pide aparte, no en
// la lista, igual que el app Vercel solo la trae en el detalle.
async function obtenerHistorialEstados(pedidoId: string) {
  return db
    .select()
    .from(pedidoEstadoLog)
    .where(eq(pedidoEstadoLog.pedidoId, pedidoId))
    .orderBy(pedidoEstadoLog.creadoEn)
}

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

// Junta pedidos + sus televisiones + bitácora de estado en una sola pasada
// (evita N+1). `filas` ya viene ordenada/filtrada por el caller (lista
// completa vs. cola de surtir con ownership). La bitácora viaja también en
// la lista (a diferencia del comentario original) porque el Excel necesita
// la fecha de despacho sin tener que pedir cada pedido uno por uno.
async function juntarConTvs(
  filas: (typeof pedidos.$inferSelect)[]
): Promise<(PedidoConTvs & { historialEstados: PedidoEstadoLogRow[] })[]> {
  if (filas.length === 0) return []
  const ids = filas.map((p) => p.id)
  const [tvs, logs] = await Promise.all([
    db.select().from(pedidoTelevisiones).where(inArray(pedidoTelevisiones.pedidoId, ids)),
    db.select().from(pedidoEstadoLog).where(inArray(pedidoEstadoLog.pedidoId, ids)),
  ])
  const tvsPorPedido = new Map<string, typeof tvs>()
  for (const tv of tvs) {
    const lista = tvsPorPedido.get(tv.pedidoId) || []
    lista.push(tv)
    tvsPorPedido.set(tv.pedidoId, lista)
  }
  const logsPorPedido = new Map<string, typeof logs>()
  for (const l of logs) {
    const lista = logsPorPedido.get(l.pedidoId) || []
    lista.push(l)
    logsPorPedido.set(l.pedidoId, lista)
  }
  return filas.map((p) => ({
    ...p,
    televisiones: (tvsPorPedido.get(p.id) || []).sort((a, b) => a.orden - b.orden),
    historialEstados: (logsPorPedido.get(p.id) || []).sort(
      (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime()
    ),
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
      condicion: tv.condicion,
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
  const historialEstados = await obtenerHistorialEstados(req.params.id)
  res.json({ ...pedido, historialEstados })
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
      // Emparejamiento por SKU + condición (marca+pulgadas+modelo+unidad+
      // condicion): dos partidas del mismo SKU con condición distinta son
      // líneas independientes y no comparten cantidadSurtida.
      const match = existente.televisiones.find(
        (v) =>
          v.marca === tv.marca &&
          v.pulgadas === tv.pulgadas &&
          v.modelo === tv.modelo &&
          v.unidad === tv.unidad &&
          v.condicion === tv.condicion
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
        condicion: tv.condicion,
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

// ── PATCH /api/pedidos/:id/estado — avanzar etapa logística ──────────────
// Solo admin y surtidor (el piso mueve carga/salida; el admin supervisa y
// puede forzar un despacho con pendientes dando una razón). Nunca "inventa"
// progreso: PENDIENTE/EN_PROCESO/TERMINADO se siguen derivando solos del
// surtido — esta ruta solo mueve las etapas que requieren una acción física
// real (carga, salida, despacho, cancelación), y dejan rastro en
// pedido_estado_log.
function pendienteYProgreso(televisiones: { cantidad: number; cantidadSurtida: number; sinLimite: boolean }[], cantidadTotal: number | null) {
  const sumaCantidades = televisiones.reduce((s, tv) => s + (tv.cantidad || 0), 0)
  const totalRequerido = typeof cantidadTotal === 'number' && cantidadTotal > 0 ? cantidadTotal : sumaCantidades
  const totalSurtido = televisiones.reduce((s, tv) => {
    const surt = tv.cantidadSurtida || 0
    if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
    return s + Math.min(tv.cantidad || 0, surt)
  }, 0)
  const progresoPct = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
  const pendiente = Math.max(0, totalRequerido - totalSurtido)
  return { pendiente, progresoPct }
}

function estadoActual(estadoOperativo: string | null, progresoPct: number): EstadoOperativo {
  if (estadoOperativo === 'CANCELADO') return 'CANCELADO'
  const computed: EstadoOperativo = progresoPct >= 100 ? 'TERMINADO' : progresoPct > 0 ? 'EN_PROCESO' : 'PENDIENTE'
  if (estadoOperativo && ESTADO_ORDEN[estadoOperativo] > ESTADO_ORDEN[computed]) {
    return estadoOperativo as EstadoOperativo
  }
  return computed
}

router.patch('/api/pedidos/:id/estado', requireRole('admin', 'surtidor'), async (req, res) => {
  const parsed = estadoTransitionInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Estado destino inválido' })
  }
  const { estado: destino, razon } = parsed.data

  const pedido = await obtenerPedidoConTvs(req.params.id)
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' })

  const usuario = getUsuario(req)!
  const { pendiente, progresoPct } = pendienteYProgreso(pedido.televisiones, pedido.cantidadTotal)
  const actual = estadoActual(pedido.estadoOperativo, progresoPct)

  if (actual === 'CANCELADO') {
    return res.status(400).json({ error: 'El pedido ya está cancelado' })
  }

  if (destino === 'CANCELADO') {
    if (actual === 'DESPACHADO') {
      return res.status(400).json({ error: 'No se puede cancelar un pedido ya despachado' })
    }
  } else {
    // Solo se puede avanzar, nunca retroceder ni "re-marcar" la misma etapa.
    if (ESTADO_ORDEN[destino] <= ESTADO_ORDEN[actual]) {
      return res.status(400).json({
        error: `No se puede pasar de "${ESTADO_LABEL[actual]}" a "${ESTADO_LABEL[destino]}"`,
      })
    }
    if (destino === 'DESPACHADO' && pendiente > 0) {
      const razonValida = typeof razon === 'string' && razon.trim().length > 0
      if (usuario.rol !== 'admin' || !razonValida) {
        return res.status(400).json({
          error: 'No se puede despachar con unidades pendientes, salvo excepción de admin con razón',
        })
      }
    }
  }

  await db.update(pedidos).set({ estadoOperativo: destino }).where(eq(pedidos.id, req.params.id))
  await db.insert(pedidoEstadoLog).values({
    pedidoId: req.params.id,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    usuarioRol: usuario.rol,
    estadoAnterior: actual,
    estadoNuevo: destino,
    observacion: typeof razon === 'string' && razon.trim() ? razon.trim() : null,
  })

  res.json({ ok: true, estado: destino })
})

export function registerPedidosRoutes(app: Express) {
  app.use(router)
}
