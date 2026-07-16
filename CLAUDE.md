# mitech-tv-orders

App interna de MiTechnologies para capturar, surtir e imprimir pedidos de televisiones.
Reemplaza pedidos por WhatsApp y Word con un formulario web y una hoja de impresión en
letra grande para surtidores.

**Migración en curso** (rama `rewrite-mi-stack`) del stack original (Next.js 15 + React 19 +
MongoDB + Vercel) al [MI Stack estándar](https://apps.mi2.com.mx/stack) de MiTechnologies.
Plan completo: ver el historial de la migración / `git log` de esta rama. `main` sigue
sirviendo la app anterior en Vercel hasta que Coolify dev/prod estén verificados y se haga
el cutover.

## Stack (destino)

- **Cliente**: Vite 6 + React 18 + TypeScript strict + Tailwind + shadcn/ui + wouter + TanStack Query v5
- **Servidor**: Node 24 + Express 4 + Drizzle ORM + Passport (OIDC + NFC/PIN híbrido)
- **DB**: PostgreSQL 16 (Coolify)
- **i18n**: react-i18next — en / es-MX / zh-CN
- **Deploy**: Coolify (dev+prod) + PM2 + workflow `/approved`

Ver `/stack`, `/stack.json`, `server/stack.ts` para el detalle vivo.

## Estructura

```
client/src/pages/     páginas (una por ruta wouter)
client/src/components/ UI (shadcn + componentes propios)
client/src/hooks/      useAuth, etc.
server/routes/         Express routers por recurso
server/auth/           Passport OIDC + estrategia NFC/PIN
server/integrations/   SQL Server WMS (mssql) + API de pallets
shared/schema.ts        tablas Drizzle + esquemas Zod (fuente única de verdad del dominio)
drizzle/                migraciones SQL generadas (committeadas)
```

## Auth híbrida (excepción documentada al hard-rule de SSO único del stack)

- `admin` / `capturista` → Nextcloud OIDC.
- `surtidor` → NFC UID o PIN (bcrypt) — dispositivo compartido en piso, sin fricción de SSO.

## Integraciones que se conservan sin cambios de lógica

- **WMS** (`server/integrations/sqlserver.ts`): SQL Server `BinManagerRO` (solo lectura).
  Ojo: usar joins directos sobre tablas base (`OM.Orders`, `OM.OrderItems`, `BM.Bins`) — las
  vistas armadas (`OM.vw_OrderDetails`, etc.) fallan por ser cross-DB con el usuario RO.
- **API de pallets** (`server/integrations/palletApi.ts`): `appsc.mitechnologiesinc.com`.
  `Movimientos` y `ProductosMovidos` vienen como JSON string escapado — doble `JSON.parse`.

## Gotchas de esta máquina

- No hay Docker ni `psql` local instalados — para levantar Postgres en dev, usar una
  instancia remota (Coolify dev, o una temporal) y apuntar `DATABASE_URL` en `.env.local`.

## Daily sync (obligatorio — leer al inicio de cada sesión)

```
curl -sSL https://apps.mi2.com.mx/stack/version.json
```

Comparar `updated_at` contra `stack_last_synced` de abajo. Si es más nuevo, propagar cambios
aquí y en la memoria del proyecto antes de trabajar.

**stack_last_synced: 2026-07-16** (v3.34.1+mi)
