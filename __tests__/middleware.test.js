import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function req(path, { method = 'GET', cookies = {} } = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest(new URL(path, 'http://localhost'), {
    method,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

describe('middleware — excepción exacta de integración Cubicaje', () => {
  it('POST a /api/integrations/cubicaje/pallets sin cookie → pasa (no bloqueado)', () => {
    const res = middleware(req('/api/integrations/cubicaje/pallets', { method: 'POST' }))
    // NextResponse.next() no trae redirect ni 401/403
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('GET a la misma ruta sin cookie → sigue bloqueado (excepción es exacta por método)', () => {
    const res = middleware(req('/api/integrations/cubicaje/pallets', { method: 'GET' }))
    expect(res.status).toBe(401)
  })

  it('POST a una ruta parecida pero distinta (subpath) sin cookie → sigue bloqueado', () => {
    const res = middleware(req('/api/integrations/cubicaje/pallets/otra-cosa', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('POST a /api/integrations/cubicaje/pallets/ (con slash final) sin cookie → sigue bloqueado', () => {
    const res = middleware(req('/api/integrations/cubicaje/pallets/', { method: 'POST' }))
    expect(res.status).toBe(401)
  })
})

describe('middleware — regresión de rutas existentes (deben mantener su comportamiento)', () => {
  it('/login sigue público', () => {
    const res = middleware(req('/login'))
    expect(res.status).toBe(200)
  })

  it('POST /api/pedidos sin cookie → 401 (igual que antes)', () => {
    const res = middleware(req('/api/pedidos', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('POST /api/pedidos con cookie de capturista → pasa (igual que antes)', () => {
    const res = middleware(req('/api/pedidos', { method: 'POST', cookies: { rol: 'capturista' } }))
    expect(res.status).toBe(200)
  })

  it('POST /api/pedidos con cookie de surtidor → 403 (igual que antes, sin permiso)', () => {
    const res = middleware(req('/api/pedidos', { method: 'POST', cookies: { rol: 'surtidor' } }))
    expect(res.status).toBe(403)
  })

  it('GET /api/pedidos-live con cualquier rol logueado → pasa (regla general de GET)', () => {
    const res = middleware(req('/api/pedidos-live/123', { method: 'GET', cookies: { rol: 'surtidor' } }))
    expect(res.status).toBe(200)
  })

  it('/surtir con cookie de surtidor → pasa (igual que antes)', () => {
    const res = middleware(req('/surtir', { cookies: { rol: 'surtidor' } }))
    expect(res.status).toBe(200)
  })

  it('/pedidos sin cookie → redirige a /login (igual que antes)', () => {
    const res = middleware(req('/pedidos'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
