import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'

// Reasigna el dueño de un pedido. Solo admin.
// Body: { userId: string | null }
export async function PATCH(req, { params }) {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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

  const { userId } = body
  const db = await getDb()

  let cambios
  if (userId) {
    if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
    }
    const usuario = await db.collection('usuarios').findOne({ _id: new ObjectId(userId) })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    cambios = {
      creadoPor: usuario._id.toString(),
      creadoPorNombre: usuario.nombre || null,
      creadoPorRol: usuario.rol,
    }
  } else {
    cambios = { creadoPor: null, creadoPorNombre: null, creadoPorRol: null }
  }

  const result = await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $set: cambios }
  )
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
