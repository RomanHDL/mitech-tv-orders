import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

export async function DELETE(_req, { params }) {
  const usuario = await getUsuario()
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection('changelog_entries').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  // Limpia los "descartados" asociados para no dejar registros huérfanos.
  await db.collection('changelog_dismissals').deleteMany({ entryId: id })

  return NextResponse.json({ ok: true })
}
