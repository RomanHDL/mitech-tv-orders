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

  const regex = new RegExp(`^${pedidoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
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

  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    asignadoA: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
  })
}
