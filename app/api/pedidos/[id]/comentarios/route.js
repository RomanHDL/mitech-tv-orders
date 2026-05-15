import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

const COMENTARIO_MAX = 2000

export async function PATCH(req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let { comentarios } = body
  if (comentarios === undefined || comentarios === null) comentarios = ''
  if (typeof comentarios !== 'string') {
    return NextResponse.json({ error: 'Comentario inválido' }, { status: 400 })
  }
  comentarios = comentarios.slice(0, COMENTARIO_MAX)

  const db = await getDb()

  const pedido = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    { projection: { creadoPor: 1 } }
  )
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        comentarios,
        comentariosActualizado: ahora,
        comentariosActualizadoPor: usuario?.userId || null,
        comentariosActualizadoPorNombre: usuario?.nombre || usuario?.email || null,
      },
    }
  )

  return NextResponse.json({
    ok: true,
    comentarios,
    actualizado: ahora.toISOString(),
    actualizadoPorNombre: usuario?.nombre || usuario?.email || null,
  })
}
