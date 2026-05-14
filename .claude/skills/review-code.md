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
   - **Validaciones**: ¿hay nuevos campos sin validar en API?
   - **SKU**: ¿se respeta `SKU_REGEX` y auto-uppercase?
   - **Sin límite**: ¿no rompe la suma del cupo?
   - **Roles**: ¿el middleware (`middleware.js`) cubre la nueva ruta?
   - **MongoDB**: ¿se mantiene la forma de los documentos (no campos huérfanos)?
   - **CSS**: ¿no se alteró el responsive (regla
     `feedback_mitech_tv_orders_responsive`)?
4. `npm run build` — debe pasar limpio.

## Reporte

Devuelve una lista corta:
- ✅ OK
- ⚠️ Riesgos (con `archivo:linea`)
- 🛑 Bloqueos (impide push)

Si hay 🛑, sugerir un fix puntual.
