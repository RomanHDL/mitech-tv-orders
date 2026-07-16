#!/bin/sh
# Migra el esquema y arranca con pm2-runtime (variante de PM2 pensada para
# contenedores: corre en foreground, respeta señales de Docker/Coolify).
set -e

echo "Aplicando migraciones..."
node dist/migrate.js

echo "Arrancando con PM2..."
exec npx --no-install pm2-runtime ecosystem.config.cjs
