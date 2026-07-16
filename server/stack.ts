// Endpoint de auto-documentación del stack (equivalente a lib/stack.js del
// app original). Se actualiza a medida que avanzan las fases; queda
// definitivo en la Fase 9 junto con Developer Manual / User Manual /
// Changelog. Sirve /stack.json, /stack.md, /llms.txt, /api/public/stack —
// parte del "daily sync" que exige apps.mi2.com.mx/stack.
import pkg from '../package.json' with { type: 'json' }
import { MARCAS, PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX } from '../shared/schema'

export const STACK = {
  name: pkg.name,
  version: pkg.version,
  description: 'Captura y surtido de pedidos de TVs — migrado al MI Stack estándar (Vite/React + Express/Drizzle + Postgres).',

  framework: {
    runtime: 'Node.js 24',
    server: 'Express 4 + Drizzle ORM',
    client: 'Vite 6 + React 18 + TypeScript (strict)',
    styling: 'Tailwind CSS + shadcn/ui',
    router: 'wouter',
    serverState: 'TanStack React Query v5',
  },

  database: {
    type: 'PostgreSQL 16',
    orm: 'Drizzle ORM + drizzle-zod',
    tablas: ['usuarios', 'pedidos', 'pedido_televisiones', 'catalogo_onn', 'session'],
    notas: 'Normalizado desde el MongoDB original (arranque limpio, sin migración de datos).',
  },

  auth: {
    modelo: 'Híbrido',
    oidc: 'Nextcloud SSO (passport-openidconnect) para admin/capturista',
    piso: 'NFC UID / PIN (bcrypt) para surtidor — excepción documentada al hard-rule de SSO único',
    sesion: 'connect-pg-simple (tabla session en Postgres), cookie httpOnly 30 días',
    roles: ['admin', 'capturista', 'surtidor'],
  },

  catalogs: {
    MARCAS,
    PULGADAS,
    CONDICIONES,
    UNIDADES,
    SKU_REGEX: SKU_REGEX.source,
  },

  i18n: {
    idiomas: ['en', 'es-MX', 'zh-CN'],
    libreria: 'react-i18next + i18next-http-backend',
  },

  deploy: {
    plataforma: 'Coolify (dev + prod)',
    proceso: 'PM2 (ecosystem.config.cjs)',
    release: '/approved',
  },

  discovery: {
    HTML: '/stack',
    JSON: '/stack.json',
    'JSON (alias)': '/api/public/stack',
    Markdown: '/stack.md',
    'llms.txt': '/llms.txt',
    health: '/api/public/health',
  },
} as const

export function toMarkdown(stack: typeof STACK = STACK, generated = new Date().toISOString()) {
  const s = stack
  return `# ${s.name} — Stack

> ${s.description}

**Versión**: ${s.version}
**Generado**: ${generated}

## Tecnología
${Object.entries(s.framework).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## Base de datos
${Object.entries(s.database).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `- **${k}**: ${v}`).join('\n')}
**Tablas**: ${s.database.tablas.join(', ')}

## Autenticación
${Object.entries(s.auth).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `- **${k}**: ${v}`).join('\n')}
**Roles**: ${s.auth.roles.join(' · ')}

## i18n
Idiomas: ${s.i18n.idiomas.join(', ')} — ${s.i18n.libreria}

## Deploy
${Object.entries(s.deploy).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## Descubrimiento
${Object.entries(s.discovery).map(([k, v]) => `- **${k}**: \`${v}\``).join('\n')}
`
}
