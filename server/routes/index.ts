import type { Express } from 'express'
import { pool } from '../db'
import { STACK, toMarkdown } from '../stack'
import { registerAuthRoutes } from './auth'
import { registerPedidosRoutes } from './pedidos'
import { registerCatalogoOnnRoutes } from './catalogo-onn'
import { registerPedidosLiveRoutes } from './pedidos-live'
import pkg from '../../package.json' with { type: 'json' }

// Registra todos los routers de la app. Cada fase añade su propio
// app.use('/api/...', router) aquí a medida que se construye:
//   Fase 2 -> /auth + /api/auth/me (OIDC + NFC/PIN)              ✓
//   Fase 3 -> /api/pedidos (CRUD + surtido + comentarios + dueño) ✓
//   Fase 4 -> /api/surtir (cola filtrada por dueño)               ✓
//   Fase 5 -> GET /api/catalogo-onn (lectura, autofill de import)  ✓
//   Fase 6 -> /api/pedidos-live (WMS: SQL Server + API de pallets) ✓
//   Fase 7 -> /api/usuarios (CRUD completo), /api/admin/*, resto de catalogo-onn (CRUD)
//   Fase 9 -> /api/documentation/*, /api/changelog/*
export async function registerRoutes(app: Express) {
  registerAuthRoutes(app)
  registerPedidosRoutes(app)
  registerCatalogoOnnRoutes(app)
  registerPedidosLiveRoutes(app)

  // ── Discovery público (sin auth) ─────────────────────────────────────
  app.get('/api/public/health', async (_req, res) => {
    const start = Date.now()
    try {
      await pool.query('SELECT 1')
      res.json({
        status: 'ok',
        name: pkg.name,
        version: pkg.version,
        db: { status: 'ok', latencyMs: Date.now() - start },
      })
    } catch (err: any) {
      res.status(503).json({ status: 'error', db: { status: 'error', message: err.message } })
    }
  })

  app.get(['/stack.json', '/api/public/stack'], (_req, res) => {
    res.json(STACK)
  })

  app.get('/stack.md', (_req, res) => {
    res.type('text/markdown').send(toMarkdown())
  })

  app.get('/llms.txt', (_req, res) => {
    res.type('text/plain').send(
      `# ${STACK.name}\n\n${STACK.description}\n\nDiscovery: /stack.json · /stack.md · /api/public/health\n`
    )
  })
}
