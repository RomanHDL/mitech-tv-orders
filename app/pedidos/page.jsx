import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import ListaCliente from './lista-cliente'
import { IconDocument, IconPlus } from '../components/icons'

export const dynamic = 'force-dynamic'

async function obtenerUsuariosAsignables() {
  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({ rol: { $in: ['admin', 'capturista'] } })
    .sort({ nombre: 1 })
    .toArray()
  return usuarios.map((u) => ({
    id: u._id.toString(),
    nombre: u.nombre || u.email || '(sin nombre)',
    rol: u.rol,
  }))
}

async function obtenerPedidos() {
  const db = await getDb()
  const pedidos = await db.collection('pedidos')
    .find({})
    .sort({ fecha: -1 })
    .limit(100)
    .toArray()

  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })

  return pedidos.map((p) => {
    const tvs = p.televisiones || []
    const { totalRequerido, totalSurtido, progresoPct, pendiente } = calcularTotales(p)
    const tienePallets = tvs.some((tv) => tv.unidad === 'pallet')
    const estadoOperativo = p.estadoOperativo || null
    const estado = normalizeOrderStatus({ progresoPct, estadoOperativo })
    return {
      id: p._id.toString(),
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre,
      condiciones: p.condiciones || [],
      fecha: p.fecha ? p.fecha.toISOString() : null,
      fechaFmt: p.fecha ? fmt.format(p.fecha) : '',
      fechaLimite: p.fechaLimite || '',
      cantidadTotal:
        typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0 ? p.cantidadTotal : null,
      totalTvs: totalRequerido,
      pendiente,
      cantidadModelos: tvs.length,
      totalSurtido,
      progresoPct,
      estadoOperativo,
      estado,
      historialEstados: p.historialEstados || [],
      tienePallets,
      creadoPor: p.creadoPor || '',
      creadoPorNombre: p.creadoPorNombre || '',
      televisiones: tvs.map((tv) => ({
        marca: tv.marca || '',
        pulgadas: tv.pulgadas || 0,
        condiciones: Array.isArray(tv.condiciones) ? tv.condiciones : (tv.condicion ? [tv.condicion] : []),
        modelo: tv.modelo || '',
        unidad: tv.unidad || 'pieza',
        cantidad: tv.cantidad || 0,
        sinLimite: !!tv.sinLimite,
        cantidadSurtida: tv.cantidadSurtida || 0,
      })),
    }
  })
}

export default async function ListaPage() {
  const [pedidos, rol, usuarios] = await Promise.all([
    obtenerPedidos(),
    getRol(),
    obtenerUsuariosAsignables(),
  ])

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Pedidos</h1>
        <p className="subtitle">
          {pedidos.length === 0
            ? 'Aún no hay pedidos guardados.'
            : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} en total`}
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <IconDocument />
            <h3>No hay pedidos aún</h3>
            <p>Crea tu primer pedido para comenzar.</p>
            <Link href="/" className="btn btn-primary">
              <IconPlus />
              Nuevo pedido
            </Link>
          </div>
        </div>
      ) : (
        <ListaCliente pedidos={pedidos} rol={rol} usuarios={usuarios} />
      )}
    </main>
  )
}
