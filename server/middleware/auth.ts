// Reemplaza middleware.js del app original (ACL global por cookies planas,
// default-deny) por Passport + sesión Postgres. En la SPA nueva el server
// (no las páginas React) es la frontera de seguridad real: apiAuthGate
// bloquea por defecto cualquier /api/* que no esté en el allowlist público,
// y cada router aplica requireRole encima para granularidad por rol —
// las páginas cliente solo redirigen por UX, no son la defensa.
// La aumentación de Express.User (req.user tipado como Usuario) viene de
// server/types.d.ts — se aplica automáticamente por estar en el `include`
// de tsconfig.json, sin necesidad de importarla (un .d.ts no es un módulo
// resolvible en runtime; importarlo rompe el bundle de esbuild).
import type { Request, Response, NextFunction } from 'express'
import type { Usuario, Rol } from '../../shared/schema'

export function getUsuario(req: Request): Usuario | null {
  return (req.isAuthenticated?.() && req.user) || null
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!getUsuario(req)) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  next()
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = getUsuario(req)
    if (!usuario) return res.status(401).json({ error: 'No autenticado' })
    if (!roles.includes(usuario.rol)) return res.status(403).json({ error: 'No autorizado' })
    next()
  }
}

// Rutas /api/* accesibles sin sesión. Todo lo demás bajo /api/* exige
// requireUser por defecto (default-deny) — cada router sigue pudiendo
// exigir un rol más estricto encima con requireRole.
const API_PUBLICO = ['/api/public/health', '/api/public/stack', '/api/auth/me']

export function apiAuthGate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next()
  if (API_PUBLICO.includes(req.path)) return next()
  if (!getUsuario(req)) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  next()
}
