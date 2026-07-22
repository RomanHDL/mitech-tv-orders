import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'

const COMENTARIO_MAX = 2000

export async function PATCH(req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  let { comentarios } = body
  if (comentarios === undefined || comentarios === null) comentarios = ''
  if (typeof comentarios !== 'string') {
    return NextResponse.json({ error: t('comentarios.errorInvalido') }, { status: 400 })
  }
  comentarios = comentarios.slice(0, COMENTARIO_MAX)

  const db = await getDb()

  const pedido = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    { projection: { creadoPor: 1 } }
  )
  if (!pedido) {
    return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
  }

  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.userId) {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
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
