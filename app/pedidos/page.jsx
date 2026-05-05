import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import ListaCliente from './lista-cliente'
import { IconDocument, IconPlus } from '../components/icons'

export const dynamic = 'force-dynamic'

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
    const totalRequerido = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
    const totalSurtido = tvs.reduce(
      (s, tv) => s + Math.min(tv.cantidad || 0, tv.cantidadSurtida || 0),
      0
    )
    const tienePallets = tvs.some((tv) => tv.unidad === 'pallet')
    const pct = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
    return {
      id: p._id.toString(),
      pedidoNombre: p.pedidoNombre,
      condiciones: p.condiciones || [],
      fechaFmt: p.fecha ? fmt.format(p.fecha) : '',
      totalTvs: totalRequerido,
      cantidadModelos: tvs.length,
      totalSurtido,
      progresoPct: pct,
      tienePallets,
    }
  })
}

export default async function ListaPage() {
  const [pedidos, rol] = await Promise.all([obtenerPedidos(), getRol()])

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
        <ListaCliente pedidos={pedidos} rol={rol} />
      )}
    </main>
  )
}
