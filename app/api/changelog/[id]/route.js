import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'

export async function DELETE(_req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('changelog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  if (chk.usuario.rol !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection('changelog_entries').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  // Limpia los "descartados" asociados para no dejar registros huérfanos.
  await db.collection('changelog_dismissals').deleteMany({ entryId: id })

  return NextResponse.json({ ok: true })
}
