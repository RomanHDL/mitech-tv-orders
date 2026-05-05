import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import EditarCliente from './editar-cliente'

export const dynamic = 'force-dynamic'

async function obtenerPedido(id) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDb()
  return db.collection('pedidos').findOne({ _id: new ObjectId(id) })
}

export default async function EditarPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

  const datos = {
    id: pedido._id.toString(),
    pedidoNombre: pedido.pedidoNombre,
    fechaLimite: pedido.fechaLimite || '',
    condiciones: pedido.condiciones || [],
    televisiones: (pedido.televisiones || []).map((tv) => ({
      marca: tv.marca,
      pulgadas: tv.pulgadas,
      modelo: tv.modelo || '',
      cantidad: tv.cantidad,
      unidad: tv.unidad || 'pieza',
    })),
  }

  return <EditarCliente pedido={datos} />
}
