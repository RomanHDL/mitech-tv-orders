import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import SurtirListaCliente from './surtir-lista-cliente'

export const dynamic = 'force-dynamic'

async function obtenerPedidos(usuario) {
  const db = await getDb()

  // Capturistas solo ven los pedidos cuyo dueño son ellas mismas.
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
      completado: pct >= 100 && totalRequerido > 0,
      cantidadMarcas: new Set(tvs.map((t) => t.marca).filter(Boolean)).size,
      totalPallets,
      totalPiezas,
    }
  })
}

export default async function SurtirIndexPage() {
  const usuario = await getUsuario()
  const pedidos = await obtenerPedidos(usuario)
  return <SurtirListaCliente pedidos={pedidos} />
}
