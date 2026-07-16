// PM2 (gate check #8). CommonJS (.cjs) a propósito: PM2 no soporta bien
// ecosystem files ESM aunque el resto del proyecto sea "type": "module".
module.exports = {
  apps: [
    {
      name: 'mitech-tv-orders',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // Coolify inyecta el resto de las variables (DATABASE_URL, SESSION_SECRET,
      // OIDC_*, SQLSERVER_*, PALLET_API_URL, PORT) vía el panel — no van aquí.
      max_memory_restart: '400M',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
}
