import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'

export async function POST(req) {
  const t = await getServerT()
  const chk = await requireModule('manual-editor')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }
  const { categoriaId, slug, titulo, contenido, orden } = body

  if (!ObjectId.isValid(categoriaId)) {
    return NextResponse.json({ error: t('apiManual.categoriaInvalida') }, { status: 400 })
  }
  const slugLimpio = typeof slug === 'string' ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : ''
  if (!slugLimpio) {
    return NextResponse.json({ error: t('apiManual.slugFormato') }, { status: 400 })
  }
  if (typeof titulo !== 'string' || !titulo.trim()) {
    return NextResponse.json({ error: t('apiChangelog.faltaTitulo') }, { status: 400 })
  }

  const db = await getDb()
  const categoria = await db.collection('documentation_categories').findOne({ _id: new ObjectId(categoriaId) })
  if (!categoria) {
    return NextResponse.json({ error: t('apiManual.categoriaNoEncontrada') }, { status: 404 })
  }

  const existente = await db.collection('documentation_pages').findOne({ categoriaId, slug: slugLimpio })
  if (existente) {
    return NextResponse.json({ error: t('apiManual.paginaExiste', { slug: slugLimpio }) }, { status: 400 })
  }

  const result = await db.collection('documentation_pages').insertOne({
    categoriaId,
    slug: slugLimpio,
    titulo: titulo.trim(),
    contenido: typeof contenido === 'string' ? contenido : '',
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 0,
    actualizado: new Date(),
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
