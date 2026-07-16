---
name: review-code
description: Revisa el diff de cambios sin commit y reporta riesgos antes de pushear a main.
tools: Read, Grep, Glob, Bash
---

# /review-code

Revisión rápida del diff actual antes de commit y push.

## Pasos

1. `git status` — listar archivos modificados.
2. `git diff` — leer cambios.
3. Revisar:
   - **Validaciones**: ¿hay nuevos campos sin validar (esquemas Zod en `shared/schema.ts`)?
   - **SKU**: ¿se respeta `SKU_REGEX` y auto-uppercase?
   - **Sin límite**: ¿no rompe la suma del cupo?
   - **Roles**: ¿el middleware (`server/middleware/`) cubre la nueva ruta?
   - **Drizzle**: ¿un cambio de esquema trae su migración (`npm run db:generate`)?
   - **CSS/Tailwind**: ¿no se alteró el responsive (regla
     `feedback_mitech_tv_orders_responsive`)?
4. `npm run check && npm run build` — debe pasar limpio.

## Reporte

Devuelve una lista corta:
- ✅ OK
- ⚠️ Riesgos (con `archivo:linea`)
- 🛑 Bloqueos (impide push)

Si hay 🛑, sugerir un fix puntual.
