# Multi-stage — gotcha del stack: NODE_ENV=production en build time hace que
# npm descarte devDependencies, y truena "vite: not found" / "tsc: not found".
# Por eso el stage de build usa --include=dev explícito; el runtime usa
# --omit=dev.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY ecosystem.config.cjs ./
COPY drizzle ./drizzle

# Migra antes de arrancar — falla el deploy si la migración falla, en vez de
# levantar la app contra un esquema desalineado.
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Healthcheck con PORT dinámico (gotcha conocido: Coolify no siempre usa el
# mismo puerto entre apps — nunca hardcodear el número).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/public/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
