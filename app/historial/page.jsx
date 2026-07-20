import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import HistorialCliente from './historial-cliente'

export const dynamic = 'force-dynamic'

async function obtenerPedidos(usuario) {
  const db = await getDb()

  // Capturistas solo ven sus propios pedidos
  const filtro =
    usuario?.rol === 'capturista' ? { creadoPor: usuario.userId } : {}

  const pedidos = await db.collection('pedidos')
    .find(filtro)
    .sort({ fecha: -1 })
    .toArray()

  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })

  return pedidos.map((p) => {
    const tvs = p.televisiones || []
    const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
    const totalRequerido =
      typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0
        ? p.cantidadTotal
        : sumaCantidades
    const totalSurtido = tvs.reduce((s, tv) => {
      const surt = tv.cantidadSurtida || 0
      if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
      return s + Math.min(tv.cantidad || 0, surt)
    }, 0)
    const pct = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
    const totalPallets = tvs.reduce((s, tv) => s + (tv.unidad === 'pallet' ? (tv.cantidad || 0) : 0), 0)
    const totalPiezas = tvs.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? (tv.cantidad || 0) : 0), 0)
    return {
      id: p._id.toString(),
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre || '(sin nombre)',
      condiciones: p.condiciones || [],
      fechaFmt: p.fecha ? fmt.format(p.fecha) : '',
      fechaIso: p.fecha ? p.fecha.toISOString() : '',
      fechaLimite: p.fechaLimite || '',
      creadoPorNombre: p.creadoPorNombre || '',
      totalRequerido,
      totalSurtido,
      progresoPct: pct,
      completado: pct >= 100 && totalRequerido > 0,
      totalPallets,
      totalPiezas,
      cantidadModelos: tvs.length,
    }
  })
}

export default async function HistorialPage() {
  const usuario = await getUsuario()
  const pedidos = await obtenerPedidos(usuario)

  // Agrupar por nombre de pedido (case-insensitive, trim)
  const mapaGrupos = new Map()
  for (const p of pedidos) {
    const clave = p.pedidoNombre.trim().toLowerCase()
    if (!mapaGrupos.has(clave)) {
      mapaGrupos.set(clave, { nombre: p.pedidoNombre, pedidos: [] })
    }
    mapaGrupos.get(clave).pedidos.push(p)
  }

  const grupos = Array.from(mapaGrupos.values())
    .map((g) => {
      const totalReq = g.pedidos.reduce((s, p) => s + p.totalRequerido, 0)
      const totalSurt = g.pedidos.reduce((s, p) => s + p.totalSurtido, 0)
      const pct = totalReq > 0 ? Math.round((totalSurt / totalReq) * 100) : 0
      const completados = g.pedidos.filter((p) => p.completado).length
      // Pedidos vienen ordenados por fecha desc, así que pedidos[0] es el más reciente.
      return {
        nombre: g.nombre,
        cantidad: g.pedidos.length,
        completados,
        totalRequerido: totalReq,
        totalSurtido: totalSurt,
        progresoPct: pct,
        ultimaFechaIso: g.pedidos[0]?.fechaIso || '',
        ultimaFechaFmt: g.pedidos[0]?.fechaFmt || '',
        pedidos: g.pedidos,
      }
    })
    // Ordenar grupos por fecha de actividad más reciente
    .sort((a, b) => (b.ultimaFechaIso || '').localeCompare(a.ultimaFechaIso || ''))

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1 className="font-display">Historial</h1>
        <p className="subtitle">
          {grupos.length === 0
            ? 'Aún no hay pedidos registrados.'
            : `${grupos.length} ${grupos.length === 1 ? 'nombre de pedido' : 'nombres de pedido'} · ${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} en total`}
        </p>
      </div>

      <HistorialCliente grupos={grupos} />
    </main>
  )
}
