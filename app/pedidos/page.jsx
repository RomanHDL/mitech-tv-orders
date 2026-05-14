import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
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
    const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
    const totalRequerido =
      typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0
        ? p.cantidadTotal
        : sumaCantidades
    // Surtido cuenta lo que se haya marcado, acotado a la cantidad del TV
    // cuando esta definida; las TVs "sin límite" cuentan tal cual.
    const totalSurtido = tvs.reduce((s, tv) => {
      const surt = tv.cantidadSurtida || 0
      if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
      return s + Math.min(tv.cantidad || 0, surt)
    }, 0)
    const tienePallets = tvs.some((tv) => tv.unidad === 'pallet')
    const pct = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
    return {
      id: p._id.toString(),
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre,
      condiciones: p.condiciones || [],
      fechaFmt: p.fecha ? fmt.format(p.fecha) : '',
      fechaLimite: p.fechaLimite || '',
      cantidadTotal:
        typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0 ? p.cantidadTotal : null,
      totalTvs: totalRequerido,
      cantidadModelos: tvs.length,
      totalSurtido,
      progresoPct: pct,
      tienePallets,
      creadoPor: p.creadoPor || '',
      creadoPorNombre: p.creadoPorNombre || '',
      televisiones: tvs.map((tv) => ({
        marca: tv.marca || '',
        pulgadas: tv.pulgadas || 0,
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
