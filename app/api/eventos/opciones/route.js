import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { idsDePedidosDeCapturista } from '@/lib/eventos'

// GET /api/eventos/opciones — opciones REALES para los filtros de Usuario y
// Condición (nunca hardcodeadas): solo usuarios que tienen al menos un
// evento registrado, y solo condiciones que existen de verdad en los pedidos.
export async function GET() {
  const usuario = await getUsuario()
  const db = await getDb()
  const idsPermitidos = await idsDePedidosDeCapturista(db, usuario)
  const filtro = idsPermitidos ? { pedidoId: { $in: idsPermitidos } } : {}

  const [usuariosAgg, condiciones] = await Promise.all([
    db
      .collection('eventos')
      .aggregate([
        { $match: { ...filtro, usuarioId: { $ne: null } } },
        { $group: { _id: '$usuarioId', nombre: { $first: '$usuarioNombre' } } },
        { $sort: { nombre: 1 } },
      ])
      .toArray(),
    db.collection('eventos').distinct('condiciones', filtro),
  ])

  return NextResponse.json({
    usuarios: usuariosAgg.map((u) => ({ id: u._id, nombre: u.nombre || '(sin nombre)' })),
    condiciones: condiciones.filter(Boolean).sort(),
  })
}
