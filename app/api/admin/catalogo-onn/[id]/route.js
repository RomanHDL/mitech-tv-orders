import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import { PULGADAS } from '@/lib/catalogos'

const COLECCION = 'catalogo_onn'

// PATCH — actualiza la pulgada de un código del catálogo. Solo admin.
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

  const pulgadas = Number(body.pulgadas)
  if (!PULGADAS.includes(pulgadas)) {
    return NextResponse.json({ error: 'Pulgadas inválidas' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection(COLECCION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { pulgadas, actualizado: new Date() } }
  )
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — elimina un código del catálogo. Solo admin.
export async function DELETE(_req, { params }) {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  const db = await getDb()
  const result = await db.collection(COLECCION).deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
