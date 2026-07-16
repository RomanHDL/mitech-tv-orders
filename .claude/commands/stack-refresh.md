---
name: stack-refresh
description: Reconcilia server/stack.ts con el estado real del repo (package.json, rutas, catálogos) y verifica que /stack siga compilando.
---

# /stack-refresh

Refresca `server/stack.ts` cuando cambian dependencias, rutas o catálogos.

## Pasos

1. Leer `package.json` → confirmar que `STACK.version` sigue igual a `pkg.version`.
2. Listar `client/src/pages/*.tsx` y `server/routes/**/*.ts` con `Glob` y reconciliar la sección de rutas si `server/stack.ts` la describe explícitamente.
3. Importar `shared/schema.ts` y confirmar que `STACK.catalogs` (MARCAS/PULGADAS/CONDICIONES/UNIDADES) sigue espejando el schema.
4. Si todo coincide, no editar.
5. Si hay drift, editar **solo** `server/stack.ts` (las demás superficies — `/stack.json`, `/stack.md`, `/llms.txt` — leen de ahí).
6. `npm run check && npm run build` — debe pasar.
7. Reportar qué se actualizó.

## Cuándo dispararlo

Después de:
- Agregar/quitar dependencias.
- Crear una nueva ruta API o página.
- Cambiar `shared/schema.ts` (nuevas marcas, condiciones, tablas).
- Cambiar la lista de roles o métodos de auth.

## Daily sync (obligatorio, apps.mi2.com.mx/stack)

Al inicio de cada sesión: `curl -sSL https://apps.mi2.com.mx/stack/version.json`, comparar contra
`stack_last_synced` en `CLAUDE.md`, propagar cambios y actualizar la fecha.
