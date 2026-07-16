// User Manual (gate #11) + Developer Manual (gate #10). Puerto del patrón
// descrito en apps.mi2.com.mx/stack — categorías jerárquicas, páginas
// bilingües, búsqueda, permisos por rol; más el diccionario de datos
// autoritativo servido en JSON/Markdown para humanos y agentes.
import { Router, type Express } from 'express'
import { eq, asc, or, ilike, and } from 'drizzle-orm'
import { db } from '../db'
import {
  documentationCategories,
  documentationPages,
  documentationCategoryInputSchema,
  documentationPageInputSchema,
  type Rol,
} from '../../shared/schema'
import { requireUser, requireRole, getUsuario } from '../middleware/auth'
import { DEVELOPER_MANUAL, toMarkdown } from '../developer-manual'

const router = Router()

// ── Developer Manual (gate #10) ──────────────────────────────────────────
// Interno: cualquier rol logueado puede consultarlo (útil para
// onboarding/debug), no es información sensible — es la forma de las tablas.
router.get('/api/developer-manual.json', requireUser, (_req, res) => {
  res.json(DEVELOPER_MANUAL)
})
router.get('/developer-manual.md', requireUser, (_req, res) => {
  res.type('text/markdown').send(toMarkdown())
})

// ── User Manual: lectura ──────────────────────────────────────────────────
router.get('/api/documentation/categories', requireUser, async (req, res) => {
  const usuario = getUsuario(req)!
  const categorias = await db.select().from(documentationCategories).orderBy(asc(documentationCategories.orden))
  const visibles = categorias.filter((c) => !c.rolMinimo || c.rolMinimo === usuario.rol)

  const paginas = await db.select().from(documentationPages).orderBy(asc(documentationPages.orden))
  const paginasPorCategoria = new Map<string, typeof paginas>()
  for (const p of paginas) {
    const lista = paginasPorCategoria.get(p.categoriaId) || []
    lista.push(p)
    paginasPorCategoria.set(p.categoriaId, lista)
  }

  res.json(
    visibles.map((c) => ({
      ...c,
      paginas: (paginasPorCategoria.get(c.id) || []).map((p) => ({
        id: p.id,
        slug: p.slug,
        tituloEs: p.tituloEs,
        tituloEn: p.tituloEn,
      })),
    }))
  )
})

router.get('/api/documentation/page/:catSlug/:pageSlug', requireUser, async (req, res) => {
  const usuario = getUsuario(req)!
  const [categoria] = await db.select().from(documentationCategories).where(eq(documentationCategories.slug, req.params.catSlug))
  if (!categoria) return res.status(404).json({ error: 'No encontrado' })
  if (categoria.rolMinimo && categoria.rolMinimo !== usuario.rol) return res.status(403).json({ error: 'No autorizado' })

  const [pagina] = await db
    .select()
    .from(documentationPages)
    .where(and(eq(documentationPages.categoriaId, categoria.id), eq(documentationPages.slug, req.params.pageSlug)))
  if (!pagina) return res.status(404).json({ error: 'No encontrado' })

  res.json({ categoria, pagina })
})

router.get('/api/documentation/search', requireUser, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.json([])
  const usuario = getUsuario(req)!

  const patron = `%${q}%`
  const resultados = await db
    .select({ pagina: documentationPages, categoria: documentationCategories })
    .from(documentationPages)
    .innerJoin(documentationCategories, eq(documentationPages.categoriaId, documentationCategories.id))
    .where(
      or(
        ilike(documentationPages.tituloEs, patron),
        ilike(documentationPages.tituloEn, patron),
        ilike(documentationPages.contenidoEs, patron),
        ilike(documentationPages.contenidoEn, patron)
      )
    )

  res.json(
    resultados
      .filter((r) => !r.categoria.rolMinimo || r.categoria.rolMinimo === usuario.rol)
      .map((r) => ({
        catSlug: r.categoria.slug,
        pageSlug: r.pagina.slug,
        tituloEs: r.pagina.tituloEs,
        tituloEn: r.pagina.tituloEn,
      }))
  )
})

// ── User Manual: administración (admin) ───────────────────────────────────
router.post('/api/documentation/admin/categories', requireRole('admin'), async (req, res) => {
  const parsed = documentationCategoryInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  const [creada] = await db
    .insert(documentationCategories)
    .values({ ...parsed.data, rolMinimo: (parsed.data.rolMinimo as Rol | null) ?? null })
    .returning({ id: documentationCategories.id })
  res.status(201).json({ id: creada.id })
})

router.patch('/api/documentation/admin/categories/:id', requireRole('admin'), async (req, res) => {
  const parsed = documentationCategoryInputSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
  const result = await db
    .update(documentationCategories)
    .set(parsed.data as Partial<typeof documentationCategories.$inferInsert>)
    .where(eq(documentationCategories.id, req.params.id))
    .returning({ id: documentationCategories.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

router.delete('/api/documentation/admin/categories/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(documentationCategories).where(eq(documentationCategories.id, req.params.id)).returning({ id: documentationCategories.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

router.post('/api/documentation/admin/pages', requireRole('admin'), async (req, res) => {
  const parsed = documentationPageInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  const [creada] = await db.insert(documentationPages).values(parsed.data).returning({ id: documentationPages.id })
  res.status(201).json({ id: creada.id })
})

router.patch('/api/documentation/admin/pages/:id', requireRole('admin'), async (req, res) => {
  const parsed = documentationPageInputSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
  const result = await db
    .update(documentationPages)
    .set({ ...parsed.data, actualizado: new Date() })
    .where(eq(documentationPages.id, req.params.id))
    .returning({ id: documentationPages.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

router.delete('/api/documentation/admin/pages/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(documentationPages).where(eq(documentationPages.id, req.params.id)).returning({ id: documentationPages.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

export function registerDocumentationRoutes(app: Express) {
  app.use(router)
}
