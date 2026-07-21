import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getRol, getUsuario } from '@/lib/auth'
import { registrarEvento } from '@/lib/eventos'

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

  const pedido = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    { projection: { numeroPedido: 1, pedidoNombre: 1, condiciones: 1, creadoPorNombre: 1 } }
  )
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  let cambios
  let nuevoDuenoNombre = null
  if (userId) {
    if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
    }
    const usuario = await db.collection('usuarios').findOne({ _id: new ObjectId(userId) })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    nuevoDuenoNombre = usuario.nombre || null
    cambios = {
      creadoPor: usuario._id.toString(),
      creadoPorNombre: usuario.nombre || null,
      creadoPorRol: usuario.rol,
    }
  } else {
    cambios = { creadoPor: null, creadoPorNombre: null, creadoPorRol: null }
  }

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $set: cambios }
  )

  const usuarioActual = await getUsuario()
  await registrarEvento(db, pedido, {
    tipo: 'CAMBIO_DUENO',
    usuarioId: usuarioActual?.userId || null,
    usuarioNombre: usuarioActual?.nombre || null,
    detalle: 'Dueño actualizado',
    detalleSecundario: `${pedido.creadoPorNombre || '— sin dueño —'} → ${nuevoDuenoNombre || '— sin dueño —'}`,
  })

  return NextResponse.json({ ok: true })
}
