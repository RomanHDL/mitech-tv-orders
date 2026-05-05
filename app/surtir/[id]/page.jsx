import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import SurtirCliente from './surtir-cliente'
import './surtir.css'

export const dynamic = 'force-dynamic'

async function obtenerPedido(id) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDb()
  return db.collection('pedidos').findOne({ _id: new ObjectId(id) })
}

export default async function SurtirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

  // Capturista solo se bloquea de pedidos creados por OTRA capturista.
  const usuario = await getUsuario()
  if (
    usuario?.rol === 'capturista' &&
    pedido.creadoPorRol === 'capturista' &&
    pedido.creadoPor !== usuario.userId
  ) {
    notFound()
  }

  // Convertir a estructura serializable para Client Component
  const datos = {
    id: pedido._id.toString(),
    pedidoNombre: pedido.pedidoNombre,
    condiciones: pedido.condiciones || [],
    televisiones: (pedido.televisiones || []).map((tv) => ({
      marca: tv.marca,
      pulgadas: tv.pulgadas,
      modelo: tv.modelo || '',
      cantidad: tv.cantidad,
      unidad: tv.unidad || 'pieza',
      cantidadSurtida: tv.cantidadSurtida || 0,
    })),
  }

  return <SurtirCliente pedido={datos} />
}
