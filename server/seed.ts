// Seed idempotente de usuarios (decisión: arranque limpio de datos, sin
// migrar Mongo, pero se re-crean los usuarios semilla que ya existían en
// lib/auth.js del app original). Se corre con `npm run db:seed` — no en
// cada arranque (a diferencia del cold-start upsert del app original,
// aquí no hay serverless cold starts que lo justifiquen).
import bcrypt from 'bcryptjs'
import { db } from './db'
import { usuarios } from '../shared/schema'
import { sql } from 'drizzle-orm'

async function seed() {
  console.log('Sembrando usuarios...')

  // Admin — entra por OIDC Nextcloud. Sin PIN: el pinHash se deja null y
  // oidcSub se completa solo en el primer login (server/auth/oidc.ts).
  await db
    .insert(usuarios)
    .values({
      email: 'romanherrera548@gmail.com',
      nombre: 'Roman',
      rol: 'admin',
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: { rol: sql`excluded.rol`, nombre: sql`excluded.nombre` },
    })

  // Surtidor — entra por NFC o PIN en piso (no por OIDC).
  const pinHash = await bcrypt.hash('123456', 10)
  await db
    .insert(usuarios)
    .values({
      email: 'lopeznthalie@gmail.com',
      nombre: 'Nathalie Lopes',
      rol: 'surtidor',
      nfcUid: '04:35:28:92:6B:1C:90',
      pinHash,
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: {
        rol: sql`excluded.rol`,
        nombre: sql`excluded.nombre`,
        nfcUid: sql`excluded.nfc_uid`,
      },
    })

  console.log('Seed completo.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Error en seed:', err)
  process.exit(1)
})
