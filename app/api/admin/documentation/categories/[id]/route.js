import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'

export async function DELETE(_req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('manual-editor')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection('documentation_categories').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: t('apiManual.noEncontrada') }, { status: 404 })
  }
  // Cascada manual: sin esto quedarían páginas huérfanas apuntando a una
  // categoría que ya no existe.
  await db.collection('documentation_pages').deleteMany({ categoriaId: id })

  return NextResponse.json({ ok: true })
}
