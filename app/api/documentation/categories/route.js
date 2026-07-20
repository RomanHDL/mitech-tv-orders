import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

// Categorías + sus páginas (solo id/slug/titulo, sin contenido) para armar el
// índice lateral del manual. Filtra por rolMinimo cuando está definido.
export async function GET() {
  const usuario = await getUsuario()
  const db = await getDb()

  const categorias = await db
    .collection('documentation_categories')
    .find({})
    .sort({ orden: 1 })
    .toArray()

  const visibles = categorias.filter((c) => !c.rolMinimo || c.rolMinimo === usuario?.rol || usuario?.rol === 'admin')

  const paginas = await db
    .collection('documentation_pages')
    .find({})
    .sort({ orden: 1 })
    .toArray()

  const resultado = visibles.map((c) => ({
    id: c._id.toString(),
    slug: c.slug,
    nombre: c.nombre,
    orden: c.orden,
    rolMinimo: c.rolMinimo || null,
    paginas: paginas
      .filter((p) => p.categoriaId === c._id.toString())
      .map((p) => ({ id: p._id.toString(), slug: p.slug, titulo: p.titulo })),
  }))

  return NextResponse.json({ categorias: resultado })
}
