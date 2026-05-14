# .claude/ — Configuración local para Claude Code

Esta carpeta sirve como referencia/plantilla. Los archivos `.md` aquí
documentan agentes, skills y comandos pensados para este repo, pero no
están activos hasta que se cree `.claude/settings.json` autorizando
hooks y permisos.

## Workflow del repo
- Branch única: `main`. Sin PRs.
- Cada cambio: build local → commit → `git push origin main`.
- Vercel detecta el push y despliega automáticamente.

## Stack
Ver `/stack`, `/stack.json`, `/stack.md` o `lib/stack.js`.

## Archivos sugeridos en esta carpeta
- `agents/documentation.md` — sub-agente para mantener README y `/stack` sincronizados.
- `agents/debugging.md` — sub-agente para investigar bugs (Vercel logs, MongoDB Atlas).
- `skills/review-code.md` — revisar diff antes de commit.
- `skills/mongo-migrate.md` — plantilla para scripts one-shot `/api/admin/migrar-*`.
- `commands/stack-refresh.md` — recargar `lib/stack.js` cuando cambia `package.json`.

## Activar permisos automáticos (manual)
Crea `.claude/settings.json` (no incluido por seguridad). Ejemplo:

```json
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push origin main)",
      "Bash(npm run build)"
    ]
  }
}
```
