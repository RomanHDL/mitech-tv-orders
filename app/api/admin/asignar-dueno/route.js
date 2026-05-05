import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getRol, normalizarEmail } from '@/lib/auth'

// Asigna creadoPor / creadoPorNombre / creadoPorRol a pedidos cuyo
// pedidoNombre coincida (case-insensitive) con el body.pedidoNombre.
// Pensado para migrar pedidos viejos a una capturista responsable.
//
// POST /api/admin/asignar-dueno
// Body: { pedidoNombre: string, email: string }
// Solo admin.
export async function POST(req) {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const pedidoNombre = typeof body.pedidoNombre === 'string' ? body.pedidoNombre.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!pedidoNombre || !email) {
    return NextResponse.json({ error: 'Falta pedidoNombre o email' }, { status: 400 })
  }

  const db = await getDb()
  const usuario = await db.collection('usuarios').findOne({ email: normalizarEmail(email) })
  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Match por substring case-insensitive (mas tolerante a variaciones)
  const escapado = pedidoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escapado, 'i')
  const result = await db.collection('pedidos').updateMany(
    { pedidoNombre: regex },
    {
      $set: {
        creadoPor: usuario._id.toString(),
        creadoPorNombre: usuario.nombre || null,
        creadoPorRol: usuario.rol,
      },
    }
  )

  // Si no hubo match, devolver lista de nombres existentes para diagnostico.
  if (result.matchedCount === 0) {
    const todos = await db
      .collection('pedidos')
      .find({}, { projection: { pedidoNombre: 1, creadoPor: 1 } })
      .toArray()
    return NextResponse.json({
      matched: 0,
      modified: 0,
      mensaje: `Ningun pedido contiene "${pedidoNombre}". Pedidos existentes:`,
      pedidos: todos.map((p) => ({
        id: p._id.toString(),
        pedidoNombre: p.pedidoNombre,
        creadoPor: p.creadoPor || null,
      })),
    })
  }

  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    asignadoA: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
  })
}
