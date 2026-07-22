import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { PULGADAS } from '@/lib/catalogos'
import { getServerT } from '@/lib/i18n-server'

const COLECCION = 'catalogo_onn'

// PATCH — actualiza la pulgada de un código del catálogo. Módulo 'onn-catalog' + rol admin.
export async function PATCH(req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('onn-catalog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  if (chk.usuario.rol !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const pulgadas = Number(body.pulgadas)
  if (!PULGADAS.includes(pulgadas)) {
    return NextResponse.json({ error: t('apiCatalogoOnn.pulgadasInvalidas') }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection(COLECCION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { pulgadas, actualizado: new Date() } }
  )
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — elimina un código del catálogo. Módulo 'onn-catalog' + rol admin.
export async function DELETE(_req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('onn-catalog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  if (chk.usuario.rol !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }
  const db = await getDb()
  const result = await db.collection(COLECCION).deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
