import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import passport from 'passport'
import http from 'node:http'
import { pool } from './db'
import { registerRoutes } from './routes'
import { setupVite } from './vite'
import { serveStatic } from './static'

// TODO (provisión Sentry): cuando `provision-app-sentry mitech-tv-orders`
// inyecte SENTRY_DSN, inicializar Sentry.init() aquí, antes que cualquier
// otro middleware, y de nuevo en client/src/main.tsx.

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const PgSession = connectPgSimple(session)

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en variables de entorno')
}

app.use(
  session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días — igual que las cookies del app original
    },
  })
)

app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
  const start = Date.now()
  const originalJson = res.json.bind(res)
  let capturedBody: unknown
  res.json = (body, ...args) => {
    capturedBody = body
    return originalJson(body, ...args)
  }
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const ms = Date.now() - start
      let line = `${req.method} ${req.path} ${res.statusCode} en ${ms}ms`
      if (capturedBody) {
        const snippet = JSON.stringify(capturedBody).slice(0, 200)
        line += ` :: ${snippet}`
      }
      console.log(line)
    }
  })
  next()
})

async function main() {
  const server = http.createServer(app)

  await registerRoutes(app)

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500
    const message = err.message || 'Error interno'
    console.error(err)
    res.status(status).json({ error: message })
  })

  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, server)
  } else {
    serveStatic(app)
  }

  const port = Number(process.env.PORT) || 3000
  server.listen(port, () => {
    console.log(`mitech-tv-orders escuchando en puerto ${port} (${process.env.NODE_ENV || 'development'})`)
  })
}

main().catch((err) => {
  console.error('Error fatal al arrancar el servidor:', err)
  process.exit(1)
})
