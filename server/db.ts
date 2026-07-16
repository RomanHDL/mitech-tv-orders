// Pool de conexión Postgres + Drizzle. Mismo patrón singleton que el
// lib/mongodb.js / lib/sqlserver.js original: se cachea en globalThis para
// sobrevivir hot-reload en dev (no hay "cold starts" de serverless en
// Coolify/PM2, pero el patrón sigue evitando abrir pools de más).
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../shared/schema'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en variables de entorno')
  }
  if (!global._pgPool) {
    global._pgPool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return global._pgPool
}

export const pool = getPool()
export const db = drizzle(pool, { schema })
