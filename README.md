# MiTech TV Orders

Aplicación interna de MiTechnologies para capturar, ordenar e imprimir pedidos de televisiones.

Reemplaza pedidos por WhatsApp y Word con un formulario web y una hoja de impresión en letra
grande para surtidores.

> **Migración en curso**: este repo se está migrando al
> [MI Stack estándar de MiTechnologies](https://apps.mi2.com.mx/stack) en la rama
> `rewrite-mi-stack`. Ver `CLAUDE.md` para el detalle. Mientras el cutover no esté cerrado,
> `main` sigue siendo la versión en producción (Next.js + MongoDB + Vercel).

## Stack

- **Vite 6 + React 18 + TypeScript** (cliente) — Tailwind CSS + shadcn/ui, wouter, TanStack Query
- **Express 4 + Drizzle ORM** (servidor) — sesión en Postgres, Passport (OIDC + NFC/PIN)
- **PostgreSQL 16**
- **Coolify** (deploy dev + prod)

## Funcionalidades

- Formulario de captura de pedidos (`/`), con condiciones, cantidad total opcional y TVs con
  marca/pulgadas/SKU/cantidad/unidad.
- Import en lote: pegar texto, subir Excel o foto (OCR en cliente con tesseract.js).
- Lista de pedidos (`/pedidos`) con búsqueda, edición, eliminación y exportación a Excel.
- Vista de impresión (`/pedidos/:id/imprimir`): agrupada por marca, ordenada por pulgadas,
  ajuste automático a una hoja carta.
- Módulo de surtido (`/surtir`, `/surtir/:id`): captura de avance por TV con autosave y undo.
- Historial agrupado (`/historial`).
- Pedidos en vivo del WMS (`/pedidos-live`, solo admin): SQL Server de solo lectura + API de
  movimientos de pallets.
- Administración: usuarios, catálogo ONN (autollenado de pulgadas al importar), tags NFC.
- Manual de usuario (`/manual`): categorías/páginas bilingües ES/EN, buscable, con permisos por rol.
- Changelog (`/changelog` + modal "novedades" al login): historial de versiones, descartable por usuario.
- Trilingüe: en / es-MX / zh-CN (selector persistido).

## Correr en local

Requiere una instancia de PostgreSQL 16 accesible. En esta máquina no hay Docker, pero sí un
Postgres 16+ real corriendo como servicio de Windows (ver `CLAUDE.md` para el detalle).

```bash
npm install
cp .env.local.example .env.local   # editar con credenciales reales
npm run db:generate                # genera SQL de migración desde shared/schema.ts
npm run db:migrate                 # aplica migraciones
npm run db:seed                    # siembra usuarios iniciales
npm run dev
```

Abrir http://localhost:3000

## Modelo de datos

Ver `shared/schema.ts` (fuente única de verdad, con Drizzle + Zod) y el Developer Manual en
`/developer-manual.md` (o `server/developer-manual.ts`) para el diccionario completo. Tablas:
`usuarios`, `pedidos`, `pedido_televisiones`, `catalogo_onn`, `documentation_categories`,
`documentation_pages`, `changelog_entries`, `changelog_items`, `changelog_dismissals`, `session`.

## Catálogos

`MARCAS`, `PULGADAS`, `CONDICIONES`, `UNIDADES`, `SKU_REGEX` viven como constantes en
`shared/schema.ts` (no son tablas — son listas cerradas que solo un admin cambia editando
código, igual que en el app original).

## Deploy

`Dockerfile` multi-stage + `docker-entrypoint.sh` (migra y arranca con `pm2-runtime`) +
`ecosystem.config.cjs`. Coolify (dev + dos apps: `mitech-tv-orders-dev` y prod), release vía
`/approved`. Checklist de infraestructura pendiente (SSO, apps de Coolify, variables de entorno)
en `CLAUDE.md`.

### Verificar el gate 12/12 del stack

```bash
npm run check:gate
```
