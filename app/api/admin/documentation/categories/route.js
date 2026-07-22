import { NextResponse } from 'next/server'
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
  const { slug, nombre, orden, rolMinimo } = body

  const slugLimpio = typeof slug === 'string' ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : ''
  if (!slugLimpio) {
    return NextResponse.json({ error: t('apiManual.slugFormato') }, { status: 400 })
  }
  if (typeof nombre !== 'string' || !nombre.trim()) {
    return NextResponse.json({ error: t('apiManual.faltaNombre') }, { status: 400 })
  }
  const rolMinimoLimpio = ['admin', 'capturista', 'surtidor'].includes(rolMinimo) ? rolMinimo : null

  const db = await getDb()
  const existente = await db.collection('documentation_categories').findOne({ slug: slugLimpio })
  if (existente) {
    return NextResponse.json({ error: t('apiManual.categoriaExiste', { slug: slugLimpio }) }, { status: 400 })
  }

  const result = await db.collection('documentation_categories').insertOne({
    slug: slugLimpio,
    nombre: nombre.trim(),
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 0,
    rolMinimo: rolMinimoLimpio,
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
