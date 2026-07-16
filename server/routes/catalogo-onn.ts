// Catálogo ONN (modelo -> pulgadas) usado para autollenar pulgadas al
// importar en lote (SKUs de ONN no traen el tamaño en el modelo). Lectura
// abierta a admin+capturista (Fase 5); CRUD de administración (Fase 7)
// solo admin — puerto de app/api/admin/catalogo-onn/**/route.js.
import { Router, type Express } from 'express'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { catalogoOnn, catalogoOnnInputSchema } from '../../shared/schema'
import { requireRole } from '../middleware/auth'

const router = Router()

router.get('/api/catalogo-onn', requireRole('admin', 'capturista'), async (_req, res) => {
  const filas = await db.select().from(catalogoOnn).orderBy(asc(catalogoOnn.modelo))
  res.json(filas)
})

router.post('/api/catalogo-onn', requireRole('admin'), async (req, res) => {
  const parsed = catalogoOnnInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' })
  }

  const [dup] = await db.select().from(catalogoOnn).where(eq(catalogoOnn.modelo, parsed.data.modelo))
  if (dup) return res.status(400).json({ error: 'Ese modelo ya está en el catálogo' })

  const [creado] = await db
    .insert(catalogoOnn)
    .values({ modelo: parsed.data.modelo, pulgadas: parsed.data.pulgadas })
    .returning({ id: catalogoOnn.id })
  res.status(201).json({ id: creado.id })
})

router.patch('/api/catalogo-onn/:id', requireRole('admin'), async (req, res) => {
  const pulgadas = Number(req.body?.pulgadas)
  const parsed = catalogoOnnInputSchema.shape.pulgadas.safeParse(pulgadas)
  if (!parsed.success) return res.status(400).json({ error: 'Pulgadas inválidas' })

  const result = await db
    .update(catalogoOnn)
    .set({ pulgadas: parsed.data, actualizado: new Date() })
    .where(eq(catalogoOnn.id, req.params.id))
    .returning({ id: catalogoOnn.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

router.delete('/api/catalogo-onn/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(catalogoOnn).where(eq(catalogoOnn.id, req.params.id)).returning({ id: catalogoOnn.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

export function registerCatalogoOnnRoutes(app: Express) {
  app.use(router)
}
