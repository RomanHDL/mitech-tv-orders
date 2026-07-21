import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'

export async function PATCH(req, { params }) {
  const chk = await requireModule('manual-editor')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

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
  const { titulo, contenido } = body
  if (typeof titulo !== 'string' || !titulo.trim()) {
    return NextResponse.json({ error: 'Falta el título' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection('documentation_pages').updateOne(
    { _id: new ObjectId(id) },
    { $set: { titulo: titulo.trim(), contenido: typeof contenido === 'string' ? contenido : '', actualizado: new Date() } }
  )
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req, { params }) {
  const chk = await requireModule('manual-editor')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection('documentation_pages').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
