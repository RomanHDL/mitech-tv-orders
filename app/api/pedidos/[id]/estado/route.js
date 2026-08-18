import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { ESTADOS_TRANSICION, ESTADO_ORDEN, estadoLabel } from '@/lib/catalogos'
import { normalizeOrderStatus, calcularTotales } from '@/lib/estado-pedido'
import { registrarEvento, TIPO_EVENTO_POR_DESTINO, detallePorDestino } from '@/lib/eventos'
import { getServerT } from '@/lib/i18n-server'

// Avanza el estado logístico de un pedido (Cargando / Listo para salida /
// Despachado / Cancelado). Solo admin y surtidor (ya filtrado por
// middleware.js, pero se re-valida aquí por defensa en profundidad).
// Nunca "inventa" progreso: PENDIENTE/EN_PROCESO/TERMINADO siguen
// derivándose solos del surtido; esta ruta solo mueve las etapas que
// requieren una acción física real (carga, salida, despacho, cancelación).
export async function PATCH(req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('estadoApi.idInvalido') }, { status: 400 })
  }

  const usuario = await getUsuario()
  if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'surtidor')) {
    return NextResponse.json({ error: t('estadoApi.noAutorizado') }, { status: 403 })
  }
  // Un surtidor mueve la etapa logística desde el módulo de Surtir; admin
  // queda sin restricción adicional de módulo (siempre puede operar aquí).
  if (usuario.rol === 'surtidor') {
    const chk = await requireModule('picking')
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('estadoApi.jsonInvalido') }, { status: 400 })
  }

  const { estado: destino, razon } = body || {}
  if (!ESTADOS_TRANSICION.includes(destino)) {
    return NextResponse.json({ error: t('estadoApi.estadoDestinoInvalido') }, { status: 400 })
  }

  // "Iniciar carga" y "Cancelar pedido" son exclusivas de admin. Se valida
  // aquí (nunca solo en el frontend) para que ni capturista ni surtidor
  // puedan lograrlo por URL, consola, Postman o cualquier llamada directa.
  if ((destino === 'CARGANDO' || destino === 'CANCELADO') && usuario.rol !== 'admin') {
    return NextResponse.json({ error: t('estadoApi.sinPermiso') }, { status: 403 })
  }

  const db = await getDb()
  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(id) })
  if (!pedido) {
    return NextResponse.json({ error: t('estadoApi.pedidoNoEncontrado') }, { status: 404 })
  }

  const { pendiente, progresoPct } = calcularTotales(pedido)
  // BUG previo: se pasaba `{ ...pedido, pendiente }` — el documento crudo de
  // Mongo nunca tiene `progresoPct` (siempre se calcula, nunca se guarda),
  // así que normalizeOrderStatus recibía progresoPct=undefined y derivaba
  // "PENDIENTE" sin importar el avance real, salvo que estadoOperativo ya
  // tuviera un valor guardado. Eso hacía que `estadoAnterior` quedara mal
  // registrado en el historial y que, en el caso de un pedido que ya había
  // llegado a una etapa (p. ej. ya estaba en CARGANDO) y se reintentaba la
  // MISMA transición, el error "transición inválida" no diera la pista
  // correcta de en qué etapa real estaba el pedido.
  const actual = normalizeOrderStatus({ estadoOperativo: pedido.estadoOperativo, progresoPct })

  if (actual === 'CANCELADO') {
    return NextResponse.json({ error: t('estadoApi.yaCancelado') }, { status: 400 })
  }

  if (destino === 'CANCELADO') {
    if (actual === 'DESPACHADO') {
      return NextResponse.json({ error: t('estadoApi.noCancelarDespachado') }, { status: 400 })
    }
  } else {
    // Solo se puede avanzar, nunca retroceder ni "re-marcar" la misma etapa.
    if (ESTADO_ORDEN[destino] <= ESTADO_ORDEN[actual]) {
      return NextResponse.json(
        { error: t('estadoApi.transicionInvalida', { actual: estadoLabel(t, actual), destino: estadoLabel(t, destino) }) },
        { status: 400 }
      )
    }
    if (destino === 'DESPACHADO' && pendiente > 0) {
      const razonValida = typeof razon === 'string' && razon.trim().length > 0
      if (usuario.rol !== 'admin' || !razonValida) {
        return NextResponse.json(
          { error: t('estadoApi.noDespacharPendiente') },
          { status: 400 }
        )
      }
    }
  }

  const entradaHistorial = {
    fecha: new Date(),
    usuarioId: usuario.userId || null,
    usuarioNombre: usuario.nombre || null,
    usuarioRol: usuario.rol,
    estadoAnterior: actual,
    estadoNuevo: destino,
    observacion: typeof razon === 'string' && razon.trim() ? razon.trim() : null,
  }

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { estadoOperativo: destino },
      $push: { historialEstados: entradaHistorial },
    }
  )

  await registrarEvento(db, pedido, {
    tipo: TIPO_EVENTO_POR_DESTINO[destino] || 'CAMBIO_ESTADO',
    estadoAnterior: actual,
    estadoNuevo: destino,
    usuarioId: usuario.userId || null,
    usuarioNombre: usuario.nombre || null,
    detalle: detallePorDestino(t, destino) || estadoLabel(t, destino),
    detalleSecundario: entradaHistorial.observacion,
  })

  return NextResponse.json({ ok: true, estado: destino })
}
