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
  let enSurtido = 0
  for (const p of pedidos) {
    const { progresoPct } = calcularTotales(p)
    const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: p.estadoOperativo || null })
    if (estado === 'DESPACHADO') despachados++
    else if (estado === 'TERMINADO') terminados++
    else if (estado === 'CANCELADO') cancelados++
    // "En surtido" = activos que todavía no han terminado (PENDIENTE o
    // EN_PROCESO). TERMINADO/CARGANDO/LISTO_SALIDA/DESPACHADO/CANCELADO no
    // cuentan aquí — ya salieron del flujo de surtido.
    else if (estado === 'PENDIENTE' || estado === 'EN_PROCESO') enSurtido++
  }

  const idsPermitidos = await idsDePedidosDeCapturista(db, usuario)
  const filtroEventos = idsPermitidos ? { pedidoId: { $in: idsPermitidos } } : {}
  const movimientosTotales = await db.collection('eventos').countDocuments(filtroEventos)

  return NextResponse.json({
    movimientosTotales,
    pedidosDespachados: despachados,
    pedidosTerminados: terminados,
    pedidosCancelados: cancelados,
    pedidosEnSurtido: enSurtido,
  })
}
