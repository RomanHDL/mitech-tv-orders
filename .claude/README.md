# .claude/ — Configuración local para Claude Code

Esta carpeta sirve como referencia/plantilla. Los archivos `.md` aquí
documentan agentes, skills y comandos pensados para este repo, pero no
están activos hasta que se cree `.claude/settings.json` autorizando
hooks y permisos.

## Workflow del repo (post-migración MI Stack)

- Rewrite en curso en la rama `rewrite-mi-stack` — `main` sigue sirviendo la
  app anterior (Next.js + Vercel) mientras Coolify dev/prod no estén verificados.
- Una vez cerrado el cutover: branch única `main`, sin PRs, deploy vía Coolify
  con el workflow `/approved` (no más auto-deploy de Vercel).
- Cada cambio: build local → commit → push. Release sancionado: `/approved [patch|minor|major] "mensaje"`.

## Stack
Ver `/stack`, `/stack.json`, `/stack.md` o `server/stack.ts`. Estándar completo: https://apps.mi2.com.mx/stack

## Archivos sugeridos en esta carpeta
- `agents/documentation.md` — sub-agente para mantener README y `/stack` sincronizados.
- `agents/debugging.md` — sub-agente para investigar bugs (logs de Coolify/PM2, Postgres).
- `skills/review-code.md` — revisar diff antes de commit.
- `commands/stack-refresh.md` — recargar `server/stack.ts` cuando cambia `package.json`.

## Activar permisos automáticos (manual)
Crea `.claude/settings.json` (no incluido por seguridad). Ejemplo:

```json
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push origin main)",
      "Bash(npm run build)",
      "Bash(npm run check)"
    ]
  }
}
```
