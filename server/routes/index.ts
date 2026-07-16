import type { Express } from 'express'
import { pool } from '../db'
import { STACK, toMarkdown } from '../stack'
import { registerAuthRoutes } from './auth'
import pkg from '../../package.json' with { type: 'json' }

// Registra todos los routers de la app. Cada fase añade su propio
// app.use('/api/...', router) aquí a medida que se construye:
//   Fase 2 -> /auth + /api/auth/me (OIDC + NFC/PIN)              ✓
//   Fase 3 -> /api/pedidos
//   Fase 4 -> (mismo router de pedidos, PATCH de surtido)
//   Fase 5 -> import/export (sin endpoint propio; corre en cliente)
//   Fase 6 -> /api/pedidos-live
//   Fase 7 -> /api/usuarios, /api/admin/*
//   Fase 9 -> /api/documentation/*, /api/changelog/*
export async function registerRoutes(app: Express) {
  registerAuthRoutes(app)

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
