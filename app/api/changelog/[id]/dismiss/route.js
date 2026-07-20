import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

// Descarta una entrada de changelog para el usuario actual (no la borra, solo
// deja de mostrarse en su modal de "novedades"). Idempotente: upsert.
export async function POST(_req, { params }) {
  const usuario = await getUsuario()
  if (!usuario?.userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const db = await getDb()
  await db.collection('changelog_dismissals').updateOne(
    { entryId: id, usuarioId: usuario.userId },
    { $setOnInsert: { entryId: id, usuarioId: usuario.userId, descartadoEn: new Date() } },
    { upsert: true }
  )

  return NextResponse.json({ ok: true })
}
