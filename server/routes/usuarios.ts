// CRUD de usuarios (admin) — puerto de app/api/usuarios/**/route.js,
// adaptado al modelo de auth híbrida de la Fase 2: admin/capturista entran
// por Nextcloud OIDC (necesitan email, nunca PIN); surtidor entra por
// NFC/PIN (PIN se guarda con bcrypt, nunca en texto plano como el original).
import { Router, type Express } from 'express'
import { eq, desc, and, ne } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { usuarios, type Rol } from '../../shared/schema'
import { canonicalEmail } from '../auth/canonical'
import { requireRole } from '../middleware/auth'

const router = Router()
const ROLES: Rol[] = ['admin', 'capturista', 'surtidor']

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
function pinValido(pin: string) {
  return /^\d{6,}$/.test(pin)
}

router.get('/api/usuarios', requireRole('admin'), async (_req, res) => {
  const filas = await db.select().from(usuarios).orderBy(desc(usuarios.creado))
  res.json(
    filas.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      tienePin: Boolean(u.pinHash),
      tieneNfc: Boolean(u.nfcUid),
      nfcUid: u.nfcUid || '',
      creado: u.creado,
    }))
  )
})

router.post('/api/usuarios', requireRole('admin'), async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : ''
  const rol = req.body?.rol as string
  const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const email = emailRaw ? canonicalEmail(emailRaw) : ''
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : ''
  const nfcUid = typeof req.body?.nfcUid === 'string' ? req.body.nfcUid.trim().toUpperCase() : ''

  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' })
  if (!ROLES.includes(rol as Rol)) return res.status(400).json({ error: 'Rol inválido' })

  if (rol === 'admin' || rol === 'capturista') {
    if (!email) return res.status(400).json({ error: 'admin/capturista necesitan email (entran por Nextcloud)' })
    if (!emailValido(email)) return res.status(400).json({ error: 'Email inválido' })
    if (pin || nfcUid) return res.status(400).json({ error: 'admin/capturista no usan PIN ni NFC — entran por Nextcloud' })
  } else {
    // surtidor
    if (!pin && !nfcUid) return res.status(400).json({ error: 'Surtidor necesita PIN o tag NFC' })
    if (pin && !pinValido(pin)) return res.status(400).json({ error: 'PIN debe ser mínimo 6 dígitos numéricos' })
    if (email && !emailValido(email)) return res.status(400).json({ error: 'Email inválido' })
  }

  if (email) {
    const [dup] = await db.select().from(usuarios).where(eq(usuarios.email, email))
    if (dup) return res.status(400).json({ error: 'Ya existe un usuario con ese email' })
  }
  if (nfcUid) {
    const [dup] = await db.select().from(usuarios).where(eq(usuarios.nfcUid, nfcUid))
    if (dup) return res.status(400).json({ error: 'Ya existe un usuario con ese tag NFC' })
  }

  const pinHash = pin ? await bcrypt.hash(pin, 10) : null

  const [creado] = await db
    .insert(usuarios)
    .values({
      nombre,
      rol: rol as Rol,
      email: email || null,
      nfcUid: nfcUid || null,
      pinHash,
    })
    .returning({ id: usuarios.id })

  res.status(201).json({ id: creado.id })
})

router.patch('/api/usuarios/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const body = req.body || {}
  const cambios: Partial<typeof usuarios.$inferInsert> = {}

  if ('nombre' in body) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre' })
    cambios.nombre = nombre
  }

  if ('rol' in body) {
    if (!ROLES.includes(body.rol)) return res.status(400).json({ error: 'Rol inválido' })
    cambios.rol = body.rol
  }

  if ('email' in body) {
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
    const email = emailRaw ? canonicalEmail(emailRaw) : ''
    if (email && !emailValido(email)) return res.status(400).json({ error: 'Email inválido' })
    if (email) {
      const [dup] = await db.select().from(usuarios).where(and(eq(usuarios.email, email), ne(usuarios.id, id)))
      if (dup) return res.status(400).json({ error: 'Ya existe otro usuario con ese email' })
      cambios.email = email
    } else {
      cambios.email = null
    }
  }

  if ('pin' in body) {
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (pin) {
      if (!pinValido(pin)) return res.status(400).json({ error: 'PIN debe ser mínimo 6 dígitos numéricos' })
      cambios.pinHash = await bcrypt.hash(pin, 10)
    }
    // pin vacío en PATCH = "no cambiar" (igual que el original: deja vacío para no cambiar el PIN)
  }

  if ('nfcUid' in body) {
    const nfcUid = typeof body.nfcUid === 'string' ? body.nfcUid.trim().toUpperCase() : ''
    if (nfcUid) {
      const [dup] = await db.select().from(usuarios).where(and(eq(usuarios.nfcUid, nfcUid), ne(usuarios.id, id)))
      if (dup) return res.status(400).json({ error: 'Ya existe otro usuario con ese tag NFC' })
      cambios.nfcUid = nfcUid
    } else {
      cambios.nfcUid = null
    }
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' })
  }

  const result = await db.update(usuarios).set(cambios).where(eq(usuarios.id, id)).returning({ id: usuarios.id })
  if (result.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json({ ok: true })
})

router.delete('/api/usuarios/:id', requireRole('admin'), async (req, res) => {
  const result = await db.delete(usuarios).where(eq(usuarios.id, req.params.id)).returning({ id: usuarios.id })
  if (result.length === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

export function registerUsuariosRoutes(app: Express) {
  app.use(router)
}
