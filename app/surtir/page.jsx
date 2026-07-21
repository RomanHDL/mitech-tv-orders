import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import SurtirListaCliente from './surtir-lista-cliente'

export const dynamic = 'force-dynamic'

// "Activos" = todavía relevantes para el piso (aunque ya esté 100% surtido,
// sigue activo hasta que se despache o cancele). Los ya DESPACHADO/CANCELADO
// se ocultan por default detrás de "Mostrar completados".
function esActivo(estado) {
  return estado !== 'DESPACHADO' && estado !== 'CANCELADO'
}

async function obtenerPedidos(usuario) {
  const db = await getDb()

  const filtro =
    usuario?.rol === 'capturista' ? { creadoPor: usuario.userId } : {}

  const pedidos = await db.collection('pedidos')
    .find(filtro)
    .sort({ fecha: -1 })
    .limit(200)
    .toArray()

  return pedidos.map((p) => {
    const tvs = p.televisiones || []
    const { totalRequerido, totalSurtido, progresoPct: pct, pendiente } = calcularTotales(p)
    const estadoOperativo = p.estadoOperativo || null
    const estado = normalizeOrderStatus({ progresoPct: pct, estadoOperativo })
    const totalPallets = tvs.reduce((s, tv) => s + (tv.unidad === 'pallet' ? (tv.cantidad || 0) : 0), 0)
    const totalPiezas = tvs.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? (tv.cantidad || 0) : 0), 0)
    return {
      id: p._id.toString(),
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre,
      condiciones: p.condiciones || [],
      fecha: p.fecha.toISOString(),
      fechaLimite: p.fechaLimite || '',
      totalRequerido,
      totalSurtido,
      pendiente,
      pct,
      estadoOperativo,
      estado,
      activo: esActivo(estado),
      completado: pct >= 100 && totalRequerido > 0,
      creadoPorNombre: p.creadoPorNombre || '',
      cantidadMarcas: new Set(tvs.map((t) => t.marca).filter(Boolean)).size,
      totalPallets,
      totalPiezas,
    }
  })
}

// "Completados hoy" viene de la bitácora real de eventos (tipo SURTIDO,
// estadoNuevo TERMINADO) — no se infiere ni se inventa: es la fecha real en
// que cada pedido cruzó el 100% de surtido.
async function obtenerCompletadosHoy(db, usuario, idsPermitidos) {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)

  const filtro = {
    tipo: 'SURTIDO',
    estadoNuevo: 'TERMINADO',
    creadoEn: { $gte: inicio, $lt: fin },
  }
  if (idsPermitidos) filtro.pedidoId = { $in: idsPermitidos }

  const ids = await db.collection('eventos').distinct('pedidoId', filtro)
  return ids.length
}

export default async function SurtirIndexPage() {
  const usuario = await getUsuario()
  const db = await getDb()
  const pedidos = await obtenerPedidos(usuario)

  const idsPermitidos = usuario?.rol === 'capturista' ? pedidos.map((p) => p.id) : null
  const completadosHoy = await obtenerCompletadosHoy(db, usuario, idsPermitidos)

  const activos = pedidos.filter((p) => p.activo)
  const metricas = {
    pedidosActivos: activos.length,
    piezasSurtidasActivos: activos.reduce((s, p) => s + p.totalSurtido, 0),
    piezasPendientesActivos: activos.reduce((s, p) => s + p.pendiente, 0),
    completadosHoy,
  }

  return <SurtirListaCliente pedidos={pedidos} metricas={metricas} rol={usuario?.rol} />
}
