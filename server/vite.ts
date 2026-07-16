// Monta Vite en modo middleware dentro de Express para dev (HMR real, un
// solo puerto para API + cliente). En producción, server/static.ts sirve el
// build de client/dist/public en su lugar.
import type { Express } from 'express'
import type { Server } from 'node:http'
import path from 'node:path'
import fs from 'node:fs/promises'

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import('vite')

  // OJO: no pasar `root` aquí. Vite busca vite.config.ts a partir del
  // `root` inline si se especifica; como nuestro config vive en la raíz del
  // repo (no dentro de client/), pasar root=client hacía que Vite no
  // encontrara/mezclara bien el resolve.alias del config real, rompiendo
  // "@/pages/..." en modo middleware (aunque `vite build` sí funcionaba).
  // Sin override, Vite usa cwd (raíz del repo, porque tsx corre desde ahí)
  // para hallar el config, y de ahí toma su propio `root: 'client'`.
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl
    try {
      const clientTemplate = path.resolve(import.meta.dirname, '..', 'client', 'index.html')
      let template = await fs.readFile(clientTemplate, 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (err) {
      vite.ssrFixStacktrace(err as Error)
      next(err)
    }
  })
}
