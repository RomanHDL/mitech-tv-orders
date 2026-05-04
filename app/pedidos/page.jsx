import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import ListaCliente from './lista-cliente'

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
    <main className="lista-container">
      <div className="lista-header">
        <h1>Pedidos</h1>
        <Link href="/" className="btn-nuevo">+ Nuevo pedido</Link>
      </div>

      {pedidos.length === 0 ? (
        <p className="empty">
          No hay pedidos aún. <Link href="/">Crea el primero</Link>.
        </p>
      ) : (
        <ListaCliente pedidos={pedidos} />
      )}
    </main>
  )
}
