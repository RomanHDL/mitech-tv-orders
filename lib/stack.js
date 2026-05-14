import pkg from '../package.json' assert { type: 'json' }
import { MARCAS, PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX } from './catalogos.js'

export const STACK = {
  name: pkg.name,
  version: pkg.version,
  description: 'Captura y surtido de pedidos de TVs (Next.js 15 App Router + MongoDB Atlas).',

  framework: {
    runtime: 'Node.js (Next.js 15)',
    framework: 'Next.js 15 App Router',
    react: 'React 19',
    language: 'JavaScript',
    bundler: 'Next.js / Turbopack',
  },

  dependencies: {
    runtime: pkg.dependencies || {},
    dev: pkg.devDependencies || {},
  },

  database: {
    type: 'MongoDB Atlas',
    driver: 'mongodb (oficial Node.js)',
    driverVersion: pkg.dependencies?.mongodb || 'n/a',
    collections: ['pedidos', 'usuarios'],
    notas: 'Sin ORM. Queries con driver nativo. Cliente cacheado en lib/mongodb.js.',
  },

  auth: {
    storage: 'Cookies HTTP-only',
    duracion: '30 días',
    metodos: ['NFC UID', 'email + PIN (6+ dígitos)', 'PIN único'],
    roles: ['admin', 'capturista', 'surtidor'],
    middlewareACL: 'middleware.js — bloquea por ruta y método HTTP',
    notas: 'Usuarios hardcodeados en lib/auth.js sincronizados a MongoDB en cold start.',
  },

  catalogs: {
    MARCAS,
    PULGADAS,
    CONDICIONES,
    UNIDADES,
    SKU_REGEX: SKU_REGEX.source,
    notas: 'SKU debe cumplir 8-10 caracteres alfanuméricos.',
  },

  routes: {
    public: [
      { path: '/login', descripcion: 'Login (email+PIN, NFC o PIN)' },
      { path: '/stack', descripcion: 'Esta página (HTML)' },
      { path: '/stack.json', descripcion: 'Stack en JSON' },
      { path: '/stack.md', descripcion: 'Stack en Markdown' },
      { path: '/api/public/stack', descripcion: 'Alias JSON' },
      { path: '/api/public/health', descripcion: 'Health check (ping a MongoDB)' },
      { path: '/llms.txt', descripcion: 'Discovery para LLMs' },
      { path: '/sitemap.xml', descripcion: 'Sitemap' },
      { path: '/robots.txt', descripcion: 'robots.txt' },
    ],
    authenticated: [
      { path: '/', roles: ['admin', 'capturista'], descripcion: 'Formulario nuevo pedido' },
      { path: '/pedidos', roles: ['admin', 'capturista'], descripcion: 'Lista de pedidos' },
      { path: '/pedidos/[id]/editar', roles: ['admin'], descripcion: 'Editar pedido' },
      { path: '/pedidos/[id]/imprimir', roles: ['admin', 'capturista', 'surtidor'], descripcion: 'Vista de impresión' },
      { path: '/surtir', roles: ['admin', 'capturista', 'surtidor'], descripcion: 'Módulo de surtido' },
      { path: '/surtir/[id]', roles: ['admin', 'capturista', 'surtidor'], descripcion: 'Surtir pedido individual' },
      { path: '/historial', roles: ['admin'], descripcion: 'Historial agrupado por nombre' },
      { path: '/admin/usuarios', roles: ['admin'], descripcion: 'CRUD usuarios' },
      { path: '/admin/tags', roles: ['admin'], descripcion: 'Gestión de tags NFC' },
    ],
    api: [
      { method: 'POST', path: '/api/auth/login', roles: 'público' },
      { method: 'POST', path: '/api/auth/logout', roles: 'público' },
      { method: 'POST', path: '/api/pedidos', roles: ['admin', 'capturista'] },
      { method: 'GET', path: '/api/pedidos/[id]', roles: ['admin', 'capturista', 'surtidor'] },
      { method: 'PUT', path: '/api/pedidos/[id]', roles: ['admin'] },
      { method: 'PATCH', path: '/api/pedidos/[id]', roles: ['admin', 'capturista', 'surtidor'] },
      { method: 'DELETE', path: '/api/pedidos/[id]', roles: ['admin'] },
      { method: 'GET', path: '/api/usuarios', roles: ['admin'] },
      { method: 'POST', path: '/api/usuarios', roles: ['admin'] },
      { method: 'PATCH', path: '/api/usuarios/[id]', roles: ['admin'] },
      { method: 'PATCH', path: '/api/admin/pedidos/[id]/dueno', roles: ['admin'] },
      { method: 'POST', path: '/api/admin/asignar-dueno', roles: ['admin'] },
      { method: 'POST', path: '/api/admin/migrar-cantidad-total', roles: ['admin'] },
    ],
  },

  features: {
    cantidadTotalPedido: 'Total opcional a nivel pedido. Cuando se define cierra la captura al alcanzarlo.',
    tvSinLimite: 'Toggle por TV — no aporta cantidad fija al cupo, cubre la diferencia del total.',
    skuMayusculas: 'Auto-uppercase al capturar SKU. Validación 8-10 alfanuméricos.',
    impresion: 'Vista de impresión auto-ajustada (FitToPage) agrupada por marca.',
    exportarExcel: 'xlsx desde /pedidos — una hoja por pedido + hoja historial.',
    nfcLogin: 'Lectura de tag NFC para login rápido.',
  },

  deploy: {
    plataforma: 'Vercel',
    branch: 'main',
    autoDeploy: true,
    notas: 'Cada push a main dispara un deploy automático en Vercel.',
  },

  ai: {
    framework: 'Claude Code',
    config: '.claude/',
    workflow: 'Auto commit + push a main (sin PR). Build verificado antes de cada push.',
  },

  discovery: {
    'HTML': '/stack',
    'JSON': '/stack.json',
    'JSON (alias)': '/api/public/stack',
    'Markdown': '/stack.md',
    'llms.txt': '/llms.txt',
    'sitemap': '/sitemap.xml',
    'robots.txt': '/robots.txt',
    'health': '/api/public/health',
  },
}

function bullets(items, fmt = (x) => `- ${x}`) {
  return items.map(fmt).join('\n')
}

function table(headers, rows) {
  const sep = headers.map(() => '---').join(' | ')
  const head = headers.join(' | ')
  const body = rows.map((r) => r.join(' | ')).join('\n')
  return `| ${head} |\n| ${sep} |\n${body.split('\n').map((l) => `| ${l} |`).join('\n')}`
}

export function toMarkdown(stack = STACK, generated = new Date().toISOString()) {
  const s = stack
  const rolesStr = (r) => (Array.isArray(r) ? r.join(', ') : r)

  return `# ${s.name} — Stack

> ${s.description}

**Versión**: ${s.version}
**Generado**: ${generated}

---

## Tecnología

${bullets(Object.entries(s.framework).map(([k, v]) => `**${k}**: ${v}`))}

### Dependencias runtime
${bullets(Object.entries(s.dependencies.runtime).map(([k, v]) => `\`${k}\` ${v}`))}

---

## Base de datos

${bullets(Object.entries(s.database).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `**${k}**: ${v}`))}

**Colecciones**: ${s.database.collections.join(', ')}

---

## Autenticación

${bullets(Object.entries(s.auth).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `**${k}**: ${v}`))}

**Roles**: ${s.auth.roles.join(' · ')}
**Métodos**: ${s.auth.metodos.join(' · ')}

---

## Catálogos

**MARCAS** (${s.catalogs.MARCAS.length}): ${s.catalogs.MARCAS.join(', ')}

**PULGADAS**: ${s.catalogs.PULGADAS.join(', ')}

**CONDICIONES**: ${s.catalogs.CONDICIONES.join(', ')}

**UNIDADES**: ${s.catalogs.UNIDADES.join(', ')}

**SKU_REGEX**: \`${s.catalogs.SKU_REGEX}\`

---

## Rutas públicas

${bullets(s.routes.public.map((r) => `\`${r.path}\` — ${r.descripcion}`))}

## Rutas autenticadas

${bullets(s.routes.authenticated.map((r) => `\`${r.path}\` (${rolesStr(r.roles)}) — ${r.descripcion}`))}

## API

${table(
    ['Método', 'Ruta', 'Roles'],
    s.routes.api.map((r) => [r.method, `\`${r.path}\``, rolesStr(r.roles)])
  )}

---

## Features

${bullets(Object.entries(s.features).map(([k, v]) => `**${k}**: ${v}`))}

---

## Deploy

${bullets(Object.entries(s.deploy).map(([k, v]) => `**${k}**: ${v}`))}

---

## AI / Claude Code

${bullets(Object.entries(s.ai).map(([k, v]) => `**${k}**: ${v}`))}

---

## Descubrimiento

${bullets(Object.entries(s.discovery).map(([k, v]) => `**${k}**: \`${v}\``))}
`
}
