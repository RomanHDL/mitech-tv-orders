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

## i18n (en / es-MX / zh-CN)

Infraestructura completa (`client/src/i18n/`, selector persistido en localStorage vía
`i18next-browser-languagedetector`, namespace `common` en `client/public/locales/{lng}/common.json`).
Traducción real aplicada al flujo diario completo: login, nav, formulario de pedido + import en
lote, lista de pedidos, surtir (cola + detalle), historial, comentarios. **Pendiente de traducir**
(quedan en español, decisión de alcance por tiempo): las 3 pantallas de `/admin/*` (usuarios,
catálogo ONN, tags), `/pedidos-live` (WMS) y la vista de impresión (`imprimir.tsx` — esta última
intencionalmente: es para surtidores en piso en México, no para el switcher de idioma).

## Deploy — checklist de infraestructura (pendiente, requiere acceso que este
## agente no tiene: Coolify, Nextcloud admin, DNS)

Código y artefactos de deploy ya están listos y verificados (`Dockerfile`, `docker-entrypoint.sh`,
`ecosystem.config.cjs`, `.dockerignore`). Se simuló el stage de runtime completo a mano en esta
máquina (sin Docker instalado): `npm ci --omit=dev` + `node dist/migrate.js` + `pm2-runtime
ecosystem.config.cjs` contra el Postgres real → healthcheck y SPA responden 200. Lo que falta es
estrictamente infraestructura, no código:

1. **SSO**: correr `provision-app-sso mitech-tv-orders` (inyecta `OIDC_ISSUER_URL/CLIENT_ID/
   CLIENT_SECRET/REDIRECT_URI`). Gotcha ya documentado en el código: `skipUserProfile:false`.
2. **Coolify**: crear las dos apps (`mitech-tv-orders-dev`, `mitech-tv-orders`) apuntando a este
   repo — dev a la rama `rewrite-mi-stack`, prod a `main` (aún sin el cutover). Build con el
   `Dockerfile` de la raíz. Postgres 16 por app (Coolify lo provisiona).
3. **Variables de entorno** por app (vía status-dashboard, nunca por chat/email): `DATABASE_URL`
   (la de Coolify, no la local), `SESSION_SECRET` (nueva, no reusar la de `.env.local`),
   `OIDC_*` (del paso 1), `SQLSERVER_*` y `PALLET_API_URL` (mismos valores que hoy, WMS no cambia).
4. **Opcional**: `provision-app-sentry mitech-tv-orders` (el `TODO` en `server/index.ts` ya
   marca dónde va `Sentry.init()`). `provision-app-mattermost` si se quiere el canal `app-mitech-tv-orders`.
5. **Primer release**: `/approved minor "Migración al MI Stack"` una vez que dev esté verificado.
6. **Cutover**: solo después de que prod en Coolify esté verificado con datos reales, hacer merge
   de `rewrite-mi-stack` → `main` y apagar el auto-deploy de Vercel (o simplemente dejar de usarlo).

Se intentó autenticar el MCP "MI Global - MI Cloud" (agents.miglobal.com.mx) para hacer estos pasos
en automático, pero la autorización no se propagó a las herramientas en esta sesión — Roman decidió
seguir sin él por ahora. Si en una sesión futura ese MCP expone herramientas reales de Coolify, usarlas
en vez de pedirle a un humano que corra estos pasos a mano.

## Gotchas de esta máquina

- No hay Docker, pero sí un **PostgreSQL 18 real** corriendo como servicio de Windows en
  `localhost:5432` (`Get-Service postgresql-x64-18`). `psql` no está en el PATH — el binario
  vive en `C:\Program Files\PostgreSQL\18\bin\psql.exe`. Rol/DB dedicados de este proyecto:
  `mitech_tv_orders` / `mitech_tv_orders` (credenciales en `.env.local`, gitignored).
- `vite.config.ts` debe usar `import.meta.dirname`, nunca `__dirname` (no existe en ESM;
  Vite bundlea el config a un temp y `__dirname` ahí apunta al lugar equivocado).
- En `server/vite.ts`, NO pasar `root` inline a `createServer()` en modo middleware —
  hace que Vite no encuentre bien el `resolve.alias` del `vite.config.ts` real (aunque
  `vite build` sí funciona sin el override). Dejar que tome `root` del config vía cwd.
- No importar un `.d.ts` (`server/types.d.ts`) como `import '../types'` — esbuild no lo
  resuelve como módulo en runtime y rompe `npm run build`. La aumentación de tipos globales
  se aplica sola por estar en el `include` de `tsconfig.json`.

## Daily sync (obligatorio — leer al inicio de cada sesión)

```
curl -sSL https://apps.mi2.com.mx/stack/version.json
```

Comparar `updated_at` contra `stack_last_synced` de abajo. Si es más nuevo, propagar cambios
aquí y en la memoria del proyecto antes de trabajar.

**stack_last_synced: 2026-07-16** (v3.34.1+mi)
