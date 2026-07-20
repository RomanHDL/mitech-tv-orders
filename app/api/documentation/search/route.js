import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

export async function GET(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ resultados: [] })

  const usuario = await getUsuario()
  const db = await getDb()

  const categorias = await db.collection('documentation_categories').find({}).toArray()
  const categoriasVisibles = new Map(
    categorias
      .filter((c) => !c.rolMinimo || c.rolMinimo === usuario?.rol || usuario?.rol === 'admin')
      .map((c) => [c._id.toString(), c])
  )

  const paginas = await db
    .collection('documentation_pages')
    .find({
      $or: [
        { titulo: { $regex: q, $options: 'i' } },
        { contenido: { $regex: q, $options: 'i' } },
      ],
    })
    .limit(30)
    .toArray()

  const resultados = paginas
    .filter((p) => categoriasVisibles.has(p.categoriaId))
    .map((p) => {
      const categoria = categoriasVisibles.get(p.categoriaId)
      return {
        id: p._id.toString(),
        categoriaSlug: categoria.slug,
        categoriaNombre: categoria.nombre,
        slug: p.slug,
        titulo: p.titulo,
      }
    })

  return NextResponse.json({ resultados })
}
