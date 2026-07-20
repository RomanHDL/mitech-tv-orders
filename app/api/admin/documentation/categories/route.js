import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

export async function POST(req) {
  const usuario = await getUsuario()
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { slug, nombre, orden, rolMinimo } = body

  const slugLimpio = typeof slug === 'string' ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : ''
  if (!slugLimpio) {
    return NextResponse.json({ error: 'Slug: solo minúsculas, números y guiones' }, { status: 400 })
  }
  if (typeof nombre !== 'string' || !nombre.trim()) {
    return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  }
  const rolMinimoLimpio = ['admin', 'capturista', 'surtidor'].includes(rolMinimo) ? rolMinimo : null

  const db = await getDb()
  const existente = await db.collection('documentation_categories').findOne({ slug: slugLimpio })
  if (existente) {
    return NextResponse.json({ error: `Ya existe la categoría "${slugLimpio}"` }, { status: 400 })
  }

  const result = await db.collection('documentation_categories').insertOne({
    slug: slugLimpio,
    nombre: nombre.trim(),
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 0,
    rolMinimo: rolMinimoLimpio,
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
