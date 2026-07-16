// Rutas de auth híbrida: OIDC (Nextcloud) para admin/capturista, NFC/PIN
// para surtidor. Reemplaza app/api/auth/login|logout/route.js del app
// original (cookies planas + PIN en texto plano) por sesión Passport +
// PIN con bcrypt.
import { Router, type Express } from 'express'
import passport from 'passport'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { usuarios, type Usuario } from '../../shared/schema'
import { canonicalEmail } from '../auth/canonical'
import { oidcConfigured } from '../auth/passport'
import { getUsuario } from '../middleware/auth'

const authRouter = Router()

// ── OIDC (admin / capturista) ────────────────────────────────────────────
authRouter.get('/auth/login', (req, res, next) => {
  if (!oidcConfigured) {
    return res.status(501).json({ error: 'Login Nextcloud no configurado en este entorno' })
  }
  passport.authenticate('openidconnect')(req, res, next)
})

authRouter.get(
  '/auth/callback',
  (req, res, next) => {
    if (!oidcConfigured) {
      return res.status(501).json({ error: 'Login Nextcloud no configurado en este entorno' })
    }
    next()
  },
  passport.authenticate('openidconnect', { failureRedirect: '/login?error=oidc' }),
  (_req, res) => {
    res.redirect('/')
  }
)

// ── NFC (surtidor) ────────────────────────────────────────────────────────
authRouter.post('/auth/nfc', async (req, res) => {
  const nfcUid = typeof req.body?.nfcUid === 'string' ? req.body.nfcUid.trim().toUpperCase() : ''
  if (!nfcUid) {
    return res.status(400).json({ error: 'Tag NFC inválido' })
  }

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.nfcUid, nfcUid))
  if (!usuario) {
    return res.status(401).json({ error: 'Tag NFC no registrado' })
  }
  if (usuario.rol !== 'surtidor') {
    return res.status(403).json({ error: 'Este método de acceso es solo para surtidores' })
  }

  req.login(usuario, (err) => {
    if (err) return res.status(500).json({ error: 'Error al iniciar sesión' })
    res.json({ rol: usuario.rol, nombre: usuario.nombre })
  })
})

// ── PIN (surtidor) ────────────────────────────────────────────────────────
// Acepta { email, pin } o solo { pin } (si es único entre los surtidores).
authRouter.post('/auth/pin', async (req, res) => {
  const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : ''

  if (!/^\d{6,}$/.test(pin)) {
    return res.status(400).json({ error: 'El PIN debe ser mínimo 6 dígitos numéricos' })
  }

  const candidatos: Usuario[] = emailRaw
    ? await db.select().from(usuarios).where(eq(usuarios.email, canonicalEmail(emailRaw)))
    : await db.select().from(usuarios).where(eq(usuarios.rol, 'surtidor'))

  const conPin = candidatos.filter((u) => u.rol === 'surtidor' && u.pinHash)

  const coincidencias: Usuario[] = []
  for (const u of conPin) {
    if (await bcrypt.compare(pin, u.pinHash as string)) coincidencias.push(u)
  }

  if (coincidencias.length !== 1) {
    return res.status(401).json({ error: 'Email o PIN incorrecto' })
  }

  const usuario = coincidencias[0]
  req.login(usuario, (err) => {
    if (err) return res.status(500).json({ error: 'Error al iniciar sesión' })
    res.json({ rol: usuario.rol, nombre: usuario.nombre })
  })
})

// ── Logout ────────────────────────────────────────────────────────────────
authRouter.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' })
    req.session.destroy(() => {
      res.clearCookie('connect.sid')
      res.json({ ok: true })
    })
  })
})

// ── Sesión actual (consumido por el hook useAuth del cliente) ────────────
authRouter.get('/api/auth/me', (req, res) => {
  const usuario = getUsuario(req)
  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  res.json({
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
  })
})

export function registerAuthRoutes(app: Express) {
  app.use(authRouter)
}
