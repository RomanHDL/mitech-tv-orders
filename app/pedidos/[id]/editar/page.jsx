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
    numeroPedido: pedido.numeroPedido || '',
    pedidoNombre: pedido.pedidoNombre,
    fechaLimite: pedido.fechaLimite || '',
    condiciones: pedido.condiciones || [],
    cantidadTotal: pedido.cantidadTotal ?? null,
    metasGrupo: pedido.metasGrupo || {},
    televisiones: (pedido.televisiones || []).map((tv) => ({
      marca: tv.marca,
      pulgadas: tv.pulgadas,
      condiciones: Array.isArray(tv.condiciones) ? tv.condiciones : (tv.condicion ? [tv.condicion] : []),
      modelo: tv.modelo || '',
      modelosAlternativos: Array.isArray(tv.modelosAlternativos) ? tv.modelosAlternativos : [],
      cantidad: tv.cantidad,
      unidad: tv.unidad || 'pieza',
      sinLimite: !!tv.sinLimite,
    })),
  }

  return <EditarCliente pedido={datos} />
}
