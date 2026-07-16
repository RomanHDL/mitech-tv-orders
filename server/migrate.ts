// Aplica las migraciones generadas por `npm run db:generate` (carpeta
// ./drizzle, committeada). Se corre en deploy (Coolify) antes de arrancar
// el server, y en local tras levantar Postgres.
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './db'

async function run() {
  console.log('Aplicando migraciones...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migraciones aplicadas.')
  await pool.end()
  process.exit(0)
}

run().catch((err) => {
  console.error('Error al migrar:', err)
  process.exit(1)
})
