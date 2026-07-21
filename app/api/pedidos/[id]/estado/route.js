import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { ESTADOS_TRANSICION, ESTADO_ORDEN, ESTADO_LABEL } from '@/lib/catalogos'
import { normalizeOrderStatus, calcularTotales } from '@/lib/estado-pedido'
import { registrarEvento, TIPO_EVENTO_POR_DESTINO, DETALLE_POR_DESTINO } from '@/lib/eventos'

// Avanza el estado logístico de un pedido (Cargando / Listo para salida /
// Despachado / Cancelado). Solo admin y surtidor (ya filtrado por
// middleware.js, pero se re-valida aquí por defensa en profundidad).
// Nunca "inventa" progreso: PENDIENTE/EN_PROCESO/TERMINADO siguen
// derivándose solos del surtido; esta ruta solo mueve las etapas que
// requieren una acción física real (carga, salida, despacho, cancelación).
export async function PATCH(req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const usuario = await getUsuario()
  if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'surtidor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
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
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { estado: destino, razon } = body || {}
  if (!ESTADOS_TRANSICION.includes(destino)) {
    return NextResponse.json({ error: 'Estado destino inválido' }, { status: 400 })
  }

  const db = await getDb()
  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(id) })
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const { pendiente } = calcularTotales(pedido)
  const actual = normalizeOrderStatus({ ...pedido, pendiente })

  if (actual === 'CANCELADO') {
    return NextResponse.json({ error: 'El pedido ya está cancelado' }, { status: 400 })
  }

  if (destino === 'CANCELADO') {
    if (actual === 'DESPACHADO') {
      return NextResponse.json({ error: 'No se puede cancelar un pedido ya despachado' }, { status: 400 })
    }
  } else {
    // Solo se puede avanzar, nunca retroceder ni "re-marcar" la misma etapa.
    if (ESTADO_ORDEN[destino] <= ESTADO_ORDEN[actual]) {
      return NextResponse.json(
        { error: `No se puede pasar de "${ESTADO_LABEL[actual]}" a "${ESTADO_LABEL[destino]}"` },
        { status: 400 }
      )
    }
    if (destino === 'DESPACHADO' && pendiente > 0) {
      const razonValida = typeof razon === 'string' && razon.trim().length > 0
      if (usuario.rol !== 'admin' || !razonValida) {
        return NextResponse.json(
          { error: 'No se puede despachar con unidades pendientes, salvo excepción de admin con razón' },
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
    detalle: DETALLE_POR_DESTINO[destino] || ESTADO_LABEL[destino],
    detalleSecundario: entradaHistorial.observacion,
  })

  return NextResponse.json({ ok: true, estado: destino })
}
