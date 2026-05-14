import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'

// Migración one-shot: a los pedidos que NO tienen cantidadTotal definido,
// se les asigna cantidadTotal = suma de tv.cantidad (excluyendo TVs sin límite,
// que en datos viejos no deberían existir). Conserva todo lo demás, incluyendo
// cantidadSurtida (avances).
//
// POST /api/admin/migrar-cantidad-total
// Solo admin.
export async function POST() {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const db = await getDb()

  const pendientes = await db
    .collection('pedidos')
    .find(
      { $or: [{ cantidadTotal: { $exists: false } }, { cantidadTotal: null }] },
      { projection: { _id: 1, pedidoNombre: 1, televisiones: 1 } }
    )
    .toArray()

  const actualizados = []
  for (const p of pendientes) {
    const tvs = Array.isArray(p.televisiones) ? p.televisiones : []
    const suma = tvs.reduce(
      (s, tv) => s + (tv?.sinLimite ? 0 : Number(tv?.cantidad) || 0),
      0
    )
    if (suma <= 0) continue
    await db
      .collection('pedidos')
      .updateOne({ _id: p._id }, { $set: { cantidadTotal: suma } })
    actualizados.push({
      id: p._id.toString(),
      pedidoNombre: p.pedidoNombre,
      cantidadTotal: suma,
    })
  }

  return NextResponse.json({
    revisados: pendientes.length,
    actualizados: actualizados.length,
    pedidos: actualizados,
  })
}
