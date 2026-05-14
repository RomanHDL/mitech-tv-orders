---
name: stack-refresh
description: Reconcilia lib/stack.js con el estado real del repo (package.json, rutas, catálogos) y verifica que /stack siga compilando.
---

# /stack-refresh

Refresca `lib/stack.js` cuando cambian dependencias, rutas o catálogos.

## Pasos

1. Leer `package.json` → confirmar que `STACK.version` y `dependencies.runtime` aún concuerdan (se calculan dinámicamente al hacer `import pkg from ...`).
2. Listar `app/**/page.jsx` y `app/api/**/route.js` con `Glob` y reconciliar `STACK.routes.public/authenticated/api`.
3. Importar `lib/catalogos.js` y confirmar que `STACK.catalogs` los espeja.
4. Si todo coincide, no editar.
5. Si hay drift, editar **solo** `lib/stack.js` (las demás superficies leen de ahí).
6. `npm run build` — debe pasar.
7. Reportar qué se actualizó.

## Cuándo dispararlo

Después de:
- Agregar/quitar dependencias.
- Crear una nueva ruta API o página.
- Cambiar `lib/catalogos.js` (nuevas marcas, condiciones, etc.).
- Cambiar la lista de roles o métodos de auth.
