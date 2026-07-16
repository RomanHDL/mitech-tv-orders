// Changelog (gate #12) — puerto del patrón descrito en apps.mi2.com.mx/stack.
// "What's new" modal en el cliente: GET /api/changelog/latest devuelve la
// entrada más nueva que el usuario actual no haya descartado.
import { Router, type Express } from 'express'
import { eq, desc, notInArray } from 'drizzle-orm'
import { db } from '../db'
import { changelogEntries, changelogItems, changelogDismissals, changelogEntryInputSchema } from '../../shared/schema'
import { requireUser, requireRole, getUsuario } from '../middleware/auth'

const router = Router()

async function conItems(entryId: string) {
  return db.select().from(changelogItems).where(eq(changelogItems.entryId, entryId)).orderBy(changelogItems.orden)
}

router.get('/api/changelog/latest', requireUser, async (req, res) => {
  const usuario = getUsuario(req)!
  const descartadas = await db.select({ entryId: changelogDismissals.entryId }).from(changelogDismissals).where(eq(changelogDismissals.usuarioId, usuario.id))
  const idsDescartados = descartadas.map((d) => d.entryId)

  const [entrada] = idsDescartados.length
    ? await db.select().from(changelogEntries).where(notInArray(changelogEntries.id, idsDescartados)).orderBy(desc(changelogEntries.publicadoEn)).limit(1)
    : await db.select().from(changelogEntries).orderBy(desc(changelogEntries.publicadoEn)).limit(1)

  if (!entrada) return res.json(null)
  res.json({ ...entrada, items: await conItems(entrada.id) })
})

router.get('/api/changelog/all', requireUser, async (_req, res) => {
  const entradas = await db.select().from(changelogEntries).orderBy(desc(changelogEntries.publicadoEn))
  const resultado = await Promise.all(entradas.map(async (e) => ({ ...e, items: await conItems(e.id) })))
  res.json(resultado)
})

router.get('/api/changelog/:id', requireUser, async (req, res) => {
  const [entrada] = await db.select().from(changelogEntries).where(eq(changelogEntries.id, req.params.id))
  if (!entrada) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ...entrada, items: await conItems(entrada.id) })
})

router.post('/api/changelog/:id/dismiss', requireUser, async (req, res) => {
  const usuario = getUsuario(req)!
  const [entrada] = await db.select().from(changelogEntries).where(eq(changelogEntries.id, req.params.id))
  if (!entrada) return res.status(404).json({ error: 'No encontrado' })

  await db
    .insert(changelogDismissals)
    .values({ entryId: entrada.id, usuarioId: usuario.id })
    .onConflictDoNothing({ target: [changelogDismissals.entryId, changelogDismissals.usuarioId] })

  res.json({ ok: true })
})

// ── Administración (admin) — crear/publicar versión ───────────────────────
router.post('/api/documentation/admin/changelog', requireRole('admin'), async (req, res) => {
  const parsed = changelogEntryInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })

  const [dup] = await db.select().from(changelogEntries).where(eq(changelogEntries.version, parsed.data.version))
  if (dup) return res.status(400).json({ error: 'Esa versión ya existe' })

  const { items, ...entryData } = parsed.data
  const [creada] = await db.insert(changelogEntries).values(entryData).returning({ id: changelogEntries.id })

  if (items.length > 0) {
    await db.insert(changelogItems).values(items.map((it, orden) => ({ entryId: creada.id, orden, textoEs: it.textoEs, textoEn: it.textoEn })))
  }

  res.status(201).json({ id: creada.id })
})

router.delete('/api/documentation/admin/changelog/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(changelogEntries).where(eq(changelogEntries.id, req.params.id)).returning({ id: changelogEntries.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

export function registerChangelogRoutes(app: Express) {
  app.use(router)
}
