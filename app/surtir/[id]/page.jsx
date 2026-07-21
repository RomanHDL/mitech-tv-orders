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

  // Capturista solo puede abrir pedidos cuyo dueño es ella misma.
  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.userId) {
    notFound()
  }

  // Convertir a estructura serializable para Client Component
  const datos = {
    id: pedido._id.toString(),
    numeroPedido: pedido.numeroPedido || '',
    pedidoNombre: pedido.pedidoNombre,
    condiciones: pedido.condiciones || [],
    cantidadTotal: typeof pedido.cantidadTotal === 'number' ? pedido.cantidadTotal : null,
    comentarios: typeof pedido.comentarios === 'string' ? pedido.comentarios : '',
    comentariosActualizado: pedido.comentariosActualizado
      ? pedido.comentariosActualizado.toISOString()
      : null,
    comentariosActualizadoPorNombre: pedido.comentariosActualizadoPorNombre || null,
    estadoOperativo: pedido.estadoOperativo || null,
    historialEstados: pedido.historialEstados || [],
    televisiones: (pedido.televisiones || []).map((tv) => ({
      marca: tv.marca,
      pulgadas: tv.pulgadas,
      condicion: tv.condicion || '',
      modelo: tv.modelo || '',
      cantidad: tv.cantidad,
      unidad: tv.unidad || 'pieza',
      sinLimite: !!tv.sinLimite,
      cantidadSurtida: tv.cantidadSurtida || 0,
    })),
  }

  return <SurtirCliente pedido={datos} rol={usuario?.rol} />
}
