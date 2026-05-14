---
name: documentation
description: Mantén README.md, /stack y lib/stack.js sincronizados con package.json y cambios de rutas/catálogos.
tools: Read, Write, Edit, Glob, Grep, Bash
---

# Documentation Agent

Mantiene la documentación viva del repo `mitech-tv-orders` consistente con
el estado real del código.

## Cuándo invocar

- Después de agregar/quitar dependencias (`npm install` o cambios en `package.json`).
- Cuando aparecen nuevas rutas (`app/**/page.jsx`, `app/api/**/route.js`).
- Cuando cambian catálogos en `lib/catalogos.js` (MARCAS, PULGADAS, CONDICIONES, SKU_REGEX).
- Cuando cambian roles, métodos de auth o permisos en `lib/auth.js` / `middleware.js`.

## Qué hacer

1. Leer `package.json`, `lib/catalogos.js`, `middleware.js`, `app/api/**/route.js`.
2. Actualizar `lib/stack.js` para reflejar el estado real:
   - `routes.public`, `routes.authenticated`, `routes.api` deben listar lo que existe.
   - `catalogs` debe coincidir con `lib/catalogos.js`.
   - `dependencies` viene auto-poblado desde `package.json`.
3. Si hay cambios funcionales notables, actualizar `README.md` con una nota.
4. Verificar `npm run build` antes de commitear.

## Reglas

- No introducir nuevas dependencias salvo que el usuario lo pida.
- No tocar `app/globals.css` ni los formularios/listas existentes.
- Commit semántico: `docs(stack): describe el cambio`.
