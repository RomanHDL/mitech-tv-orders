import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import { idsDePedidosDeCapturista } from '@/lib/eventos'

// GET /api/eventos/metricas — las 5 tarjetas del encabezado. Se calculan
// sobre el TOTAL real (no sobre los filtros de la tabla), mismo criterio que
// las tarjetas de /pedidos y /historial (dashboard resume todo; los filtros
// son solo para la tabla de abajo).
export async function GET() {
  const usuario = await getUsuario()
  const db = await getDb()

  const filtroPedidos = usuario?.rol === 'capturista' ? { creadoPor: usuario.userId } : {}
  const pedidos = await db
    .collection('pedidos')
    .find(filtroPedidos, { projection: { televisiones: 1, cantidadTotal: 1, estadoOperativo: 1 } })
    .toArray()

  let despachados = 0
  let terminados = 0
  let cancelados = 0
  for (const p of pedidos) {
    const { progresoPct } = calcularTotales(p)
    const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: p.estadoOperativo || null })
    if (estado === 'DESPACHADO') despachados++
    else if (estado === 'TERMINADO') terminados++
    else if (estado === 'CANCELADO') cancelados++
  }

  const idsPermitidos = await idsDePedidosDeCapturista(db, usuario)
  const filtroEventos = idsPermitidos ? { pedidoId: { $in: idsPermitidos } } : {}
  const movimientosTotales = await db.collection('eventos').countDocuments(filtroEventos)

  // Tiempo promedio de creación a despacho: solo para pedidos que tienen
  // AMBOS eventos reales (no se estima ni se inventa para el resto).
  const pipeline = [
    { $match: { ...filtroEventos, tipo: { $in: ['CREACION', 'DESPACHO'] } } },
    {
      $group: {
        _id: '$pedidoId',
        creacion: { $min: { $cond: [{ $eq: ['$tipo', 'CREACION'] }, '$creadoEn', '$$REMOVE'] } },
        despacho: { $min: { $cond: [{ $eq: ['$tipo', 'DESPACHO'] }, '$creadoEn', '$$REMOVE'] } },
      },
    },
    { $match: { creacion: { $ne: null }, despacho: { $ne: null } } },
    { $project: { horas: { $divide: [{ $subtract: ['$despacho', '$creacion'] }, 1000 * 60 * 60] } } },
    { $group: { _id: null, promedioHoras: { $avg: '$horas' }, n: { $sum: 1 } } },
  ]
  const resultado = await db.collection('eventos').aggregate(pipeline).toArray()
  const tiempoPromedioHoras = resultado[0]?.n > 0 ? resultado[0].promedioHoras : null

  return NextResponse.json({
    movimientosTotales,
    pedidosDespachados: despachados,
    pedidosTerminados: terminados,
    pedidosCancelados: cancelados,
    tiempoPromedioHoras,
  })
}
