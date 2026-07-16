// Seed idempotente de usuarios (decisión: arranque limpio de datos, sin
// migrar Mongo, pero se re-crean los usuarios semilla que ya existían en
// lib/auth.js del app original). Se corre con `npm run db:seed` — no en
// cada arranque (a diferencia del cold-start upsert del app original,
// aquí no hay serverless cold starts que lo justifiquen).
import bcrypt from 'bcryptjs'
import { db } from './db'
import { usuarios, documentationCategories, documentationPages, changelogEntries, changelogItems } from '../shared/schema'
import { eq, sql } from 'drizzle-orm'
import pkg from '../package.json' with { type: 'json' }

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

  console.log('Sembrando manual de usuario...')

  const [catPrimerosPasos] = await db
    .insert(documentationCategories)
    .values({ slug: 'primeros-pasos', nombreEs: 'Primeros pasos', nombreEn: 'Getting started', orden: 0, rolMinimo: null })
    .onConflictDoUpdate({ target: documentationCategories.slug, set: { nombreEs: sql`excluded.nombre_es`, nombreEn: sql`excluded.nombre_en` } })
    .returning({ id: documentationCategories.id })

  const [catAdmin] = await db
    .insert(documentationCategories)
    .values({ slug: 'administracion', nombreEs: 'Administración', nombreEn: 'Administration', orden: 1, rolMinimo: 'admin' })
    .onConflictDoUpdate({ target: documentationCategories.slug, set: { nombreEs: sql`excluded.nombre_es`, nombreEn: sql`excluded.nombre_en` } })
    .returning({ id: documentationCategories.id })

  await db
    .insert(documentationPages)
    .values({
      categoriaId: catPrimerosPasos.id,
      slug: 'capturar-pedido',
      tituloEs: 'Cómo capturar un pedido',
      tituloEn: 'How to capture an order',
      contenidoEs:
        'Ve a "Nuevo pedido", captura número, nombre y fecha límite. Agrega cada televisión con marca, pulgadas, modelo (SKU) y cantidad. Si el pedido tiene un tope fijo, captúralo en "Cantidad total del pedido" — el formulario no te deja exceder ese límite. Puedes importar varias TVs a la vez pegando texto, subiendo un Excel o tomando una foto del pedido (botón "Importar pedido en lote"). Al enviar, se abre la vista de impresión lista para imprimir.',
      contenidoEn:
        'Go to "New order", enter the order number, name, and deadline. Add each TV with brand, inches, model (SKU), and quantity. If the order has a fixed cap, enter it under "Order total quantity" — the form won\'t let you exceed it. You can import several TVs at once by pasting text, uploading an Excel file, or taking a photo of the order ("Bulk import order" button). On submit, the print-ready view opens automatically.',
      orden: 0,
    })
    .onConflictDoUpdate({
      target: [documentationPages.categoriaId, documentationPages.slug],
      set: { tituloEs: sql`excluded.titulo_es`, tituloEn: sql`excluded.titulo_en`, contenidoEs: sql`excluded.contenido_es`, contenidoEn: sql`excluded.contenido_en` },
    })

  await db
    .insert(documentationPages)
    .values({
      categoriaId: catPrimerosPasos.id,
      slug: 'surtir-pedido',
      tituloEs: 'Cómo surtir un pedido',
      tituloEn: 'How to fulfill an order',
      contenidoEs:
        'En "Surtir" verás los pedidos pendientes como tarjetas con su avance. Abre uno y captura cuántas piezas de cada TV ya surtiste — puedes teclear el número directo o usar los botones +/− /marcar todas/reiniciar. Cada cambio se guarda solo (verás "Guardando…" y luego "Guardado"); si te equivocas, un aviso de "Deshacer" aparece unos segundos después de cada cambio.',
      contenidoEn:
        '"Fulfill" shows pending orders as cards with their progress. Open one and enter how many pieces of each TV you\'ve already fulfilled — type the number directly or use the +/− / mark-all / reset buttons. Every change autosaves (you\'ll see "Saving…" then "Saved"); if you make a mistake, an "Undo" prompt appears for a few seconds after each change.',
      orden: 1,
    })
    .onConflictDoUpdate({
      target: [documentationPages.categoriaId, documentationPages.slug],
      set: { tituloEs: sql`excluded.titulo_es`, tituloEn: sql`excluded.titulo_en`, contenidoEs: sql`excluded.contenido_es`, contenidoEn: sql`excluded.contenido_en` },
    })

  await db
    .insert(documentationPages)
    .values({
      categoriaId: catAdmin.id,
      slug: 'usuarios',
      tituloEs: 'Gestión de usuarios',
      tituloEn: 'User management',
      contenidoEs:
        'Admin y capturista entran con su cuenta de Nextcloud — solo necesitan tener capturado su email aquí. Surtidor entra por PIN y/o tag NFC, sin cuenta de Nextcloud: usa "Escanear tag" con el teléfono para vincular el serial del tag a su usuario.',
      contenidoEn:
        'Admin and clerk sign in with their Nextcloud account — they just need their email registered here. Picker signs in via PIN and/or NFC tag, no Nextcloud account needed: use "Scan tag" on the phone to link the tag\'s serial to their user.',
      orden: 0,
    })
    .onConflictDoUpdate({
      target: [documentationPages.categoriaId, documentationPages.slug],
      set: { tituloEs: sql`excluded.titulo_es`, tituloEn: sql`excluded.titulo_en`, contenidoEs: sql`excluded.contenido_es`, contenidoEn: sql`excluded.contenido_en` },
    })

  console.log('Sembrando changelog...')

  const [entry] = await db
    .insert(changelogEntries)
    .values({
      version: pkg.version,
      tituloEs: 'Migración al MI Stack',
      tituloEn: 'Migration to the MI Stack',
      categoria: 'feature',
      prioridad: 'high',
    })
    .onConflictDoNothing({ target: changelogEntries.version })
    .returning({ id: changelogEntries.id })

  const entryId = entry?.id ?? (await db.select({ id: changelogEntries.id }).from(changelogEntries).where(eq(changelogEntries.version, pkg.version)))[0]?.id

  if (entry && entryId) {
    await db.insert(changelogItems).values([
      { entryId, orden: 0, textoEs: 'Nuevo stack: Vite + React + TypeScript, Express + Drizzle, PostgreSQL.', textoEn: 'New stack: Vite + React + TypeScript, Express + Drizzle, PostgreSQL.' },
      { entryId, orden: 1, textoEs: 'Login con Nextcloud para admin/capturista; NFC/PIN para surtidor en piso.', textoEn: 'Nextcloud login for admin/clerk; NFC/PIN for floor pickers.' },
      { entryId, orden: 2, textoEs: 'Soporte en español, inglés y chino.', textoEn: 'Spanish, English, and Chinese support.' },
    ])
  }

  console.log('Seed completo.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Error en seed:', err)
  process.exit(1)
})
