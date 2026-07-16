import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// OJO: __dirname no existe en ESM ("type": "module" en package.json), y
// Vite bundlea este config en un archivo temporal — usar __dirname aquí
// resuelve las rutas relativas al temp, no al proyecto real. import.meta.dirname
// (Node 20.11+/22+) sí apunta al directorio real de este archivo.
const rootDir = import.meta.dirname

export default defineConfig({
  plugins: [react()],
  root: path.resolve(rootDir, 'client'),
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'client/src'),
      '@shared': path.resolve(rootDir, 'shared'),
    },
  },
  build: {
    outDir: path.resolve(rootDir, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    fs: { allow: [path.resolve(rootDir, 'client'), path.resolve(rootDir, 'shared')] },
  },
})
