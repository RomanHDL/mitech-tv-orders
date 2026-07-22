import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import { unidadLabel } from '@/lib/catalogos'
import { getServerT } from '@/lib/i18n-server'

// GET /api/eventos/pedido/:pedidoId — panel lateral: datos reales del
// pedido + su línea de tiempo completa. Se pide únicamente cuando el
// usuario selecciona una fila (nunca se precarga para toda la tabla).
export async function GET(_req, { params }) {
  const t = await getServerT()
  const { pedidoId } = await params
  if (!ObjectId.isValid(pedidoId)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  const usuario = await getUsuario()
  const db = await getDb()

  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(pedidoId) })
  if (!pedido) {
    return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
  }
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.userId) {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }

  const tvs = pedido.televisiones || []
  const { totalRequerido, totalSurtido, progresoPct, pendiente } = calcularTotales(pedido)
  const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: pedido.estadoOperativo || null })
  const unidades = new Set(tvs.map((tv) => tv.unidad || 'pieza'))
  const unidad = unidades.size === 0
    ? '—'
    : unidades.size === 1
      ? unidadLabel(t, 2, [...unidades][0], true)
      : t('common.mixto')

  const eventos = await db
    .collection('eventos')
    .find({ pedidoId })
    .sort({ creadoEn: -1 })
    .toArray()

  return NextResponse.json({
    pedido: {
      id: pedido._id.toString(),
      numeroPedido: pedido.numeroPedido || '',
      pedidoNombre: pedido.pedidoNombre,
      condiciones: pedido.condiciones || [],
      unidad,
      creadoPorNombre: pedido.creadoPorNombre || '',
      fecha: pedido.fecha ? pedido.fecha.toISOString() : null,
      fechaLimite: pedido.fechaLimite || '',
      estado,
      totalRequerido,
      totalSurtido,
      pendiente,
    },
    eventos: eventos.map((e) => ({ ...e, _id: e._id.toString() })),
  })
}
