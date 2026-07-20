import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
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
  const { categoriaId, slug, titulo, contenido, orden } = body

  if (!ObjectId.isValid(categoriaId)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }
  const slugLimpio = typeof slug === 'string' ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : ''
  if (!slugLimpio) {
    return NextResponse.json({ error: 'Slug: solo minúsculas, números y guiones' }, { status: 400 })
  }
  if (typeof titulo !== 'string' || !titulo.trim()) {
    return NextResponse.json({ error: 'Falta el título' }, { status: 400 })
  }

  const db = await getDb()
  const categoria = await db.collection('documentation_categories').findOne({ _id: new ObjectId(categoriaId) })
  if (!categoria) {
    return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
  }

  const existente = await db.collection('documentation_pages').findOne({ categoriaId, slug: slugLimpio })
  if (existente) {
    return NextResponse.json({ error: `Ya existe la página "${slugLimpio}" en esa categoría` }, { status: 400 })
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
