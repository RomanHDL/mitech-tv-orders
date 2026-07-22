import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'

export async function GET(_req, { params }) {
  const t = await getServerT()
  const { catSlug, pageSlug } = await params
  const usuario = await getUsuario()
  const db = await getDb()

  const categoria = await db.collection('documentation_categories').findOne({ slug: catSlug })
  if (!categoria) return NextResponse.json({ error: t('apiManual.categoriaNoEncontrada') }, { status: 404 })
  if (categoria.rolMinimo && categoria.rolMinimo !== usuario?.rol && usuario?.rol !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }

  const pagina = await db.collection('documentation_pages').findOne({
    categoriaId: categoria._id.toString(),
    slug: pageSlug,
  })
  if (!pagina) return NextResponse.json({ error: t('apiManual.paginaNoEncontrada') }, { status: 404 })

  return NextResponse.json({
    pagina: {
      id: pagina._id.toString(),
      categoriaSlug: categoria.slug,
      categoriaNombre: categoria.nombre,
      slug: pagina.slug,
      titulo: pagina.titulo,
      contenido: pagina.contenido,
      actualizado: pagina.actualizado,
    },
  })
}
