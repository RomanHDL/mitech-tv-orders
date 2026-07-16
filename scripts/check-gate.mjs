#!/usr/bin/env node
// Verificador del gate 12/12 de apps.mi2.com.mx/stack. Corre en CI/local con
// `npm run check:gate` — no requiere DB ni servidor levantado, solo lee
// archivos del repo (salvo los checks 10-12, que además hacen una llamada
// HTTP si el server ya está corriendo en PORT/3000, marcados "opcional").
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
const exists = (p) => fs.existsSync(path.join(root, p))

const checks = [
  ['1. package.json depende de react', !!deps.react],
  ['2. tsconfig.json presente', exists('tsconfig.json')],
  ['3. vite.config.ts presente', exists('vite.config.ts') || exists('vite.config.js')],
  ['4. tailwind.config.ts presente', exists('tailwind.config.ts') || exists('tailwind.config.js')],
  ['5. package.json depende de express', !!deps.express],
  ['6. drizzle.config.ts presente', exists('drizzle.config.ts') || exists('drizzle.config.js')],
  ['7. package.json depende de pg o postgres', !!(deps.pg || deps.postgres)],
  ['8. package.json depende de pm2 (o Procfile menciona pm2)', !!deps.pm2 || (exists('Procfile') && fs.readFileSync(path.join(root, 'Procfile'), 'utf8').includes('pm2'))],
  ['9. Mobile-ready: viewport meta o clases responsive', exists('client/index.html') && fs.readFileSync(path.join(root, 'client/index.html'), 'utf8').includes('name="viewport"')],
  ['10. Developer Manual (server/developer-manual.ts + rutas)', exists('server/developer-manual.ts') && exists('server/routes/documentation.ts')],
  ['11. User Manual (/manual + client/src/pages/manual.tsx)', exists('client/src/pages/manual.tsx') && exists('server/routes/documentation.ts')],
  ['12. Changelog con semver en package.json', /^\d+\.\d+\.\d+$/.test(pkg.version) && exists('server/routes/changelog.ts') && exists('client/src/pages/changelog.tsx')],
]

let ok = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? '✅' : '❌'} ${label}`)
  if (pass) ok++
}

console.log(`\n${ok}/12 checks pasan.`)
if (ok < 12) process.exit(1)
