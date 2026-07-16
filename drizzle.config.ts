import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit corre como CLI aparte (no vía tsx), así que no hereda el
// --env-file=.env.local de los scripts npm; cargamos el mismo archivo a mano.
dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en variables de entorno')
}

export default defineConfig({
  out: './drizzle',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
