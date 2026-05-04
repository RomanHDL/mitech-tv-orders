import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
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

  return pedidos.map((p) => ({
    id: p._id.toString(),
    pedidoNombre: p.pedidoNombre,
    condiciones: p.condiciones || [],
    fecha: p.fecha.toISOString(),
    totalTvs: (p.televisiones || []).reduce((s, tv) => s + (tv.cantidad || 0), 0),
    cantidadModelos: (p.televisiones || []).length,
  }))
}

export default async function ListaPage() {
  const pedidos = await obtenerPedidos()

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
        <ListaCliente pedidos={pedidos} />
      )}
    </main>
  )
}
