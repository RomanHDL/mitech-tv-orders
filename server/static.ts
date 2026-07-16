// Sirve el build de producción (client/dist/public) con fallback SPA para
// las rutas de wouter (todas resuelven a index.html salvo /api y estáticos).
import type { Express } from 'express'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, 'public')

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `No se encontró el build de cliente en ${distPath}. Corre "npm run build" antes de "npm start".`
    )
  }

  app.use(express.static(distPath))
  app.use('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'))
  })
}
