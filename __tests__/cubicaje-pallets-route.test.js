import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEY = 'CUBICAJE_PEDIDOS_INTEGRATION_KEY'
const SECRETO = 'secreto-de-prueba-123'

function crearColeccionesFake() {
  const pallets = new Map()
  const eventos = new Map()
  return {
    pallets: {
      async upsertSiMasNuevo({ palletId, lastSync, campos }, ahora) {
        const existente = pallets.get(palletId)
        if (!existente) {
          pallets.set(palletId, { palletId, lastSync, ...campos })
          return 'creado'
        }
        if (lastSync > existente.lastSync) {
          pallets.set(palletId, { ...existente, lastSync, ...campos })
          return 'actualizado'
        }
        return 'ignorado_desactualizado'
      },
    },
    eventos: {
      async findOne({ eventId }) {
        return eventos.get(eventId) ?? null
      },
      async insertOne(doc) {
        eventos.set(doc.eventId, doc)
      },
    },
    syncStatus: {
      async updateOne() {},
    },
  }
}

vi.mock('@/lib/integration-cubicaje-db', () => ({
  getColeccionesCubicaje: vi.fn(async () => crearColeccionesFake()),
}))

const rutaModulo = await import('@/app/api/integrations/cubicaje/pallets/route')
const { POST } = rutaModulo

function payloadValido(overrides = {}) {
  return {
    eventId: 'evt-1',
    payloadVersion: 1,
    palletId: '389156-0015',
    cantidadTotal: 12,
    productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5 }],
    ubicacion: 'REFM2',
    activo: true,
    lastSync: '2026-07-29T14:49:58.210Z',
    ...overrides,
  }
}

function req({ headers = {}, body } = {}) {
  return new Request('http://localhost/api/integrations/cubicaje/pallets', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/integrations/cubicaje/pallets', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = SECRETO
  })
  afterEach(() => {
    delete process.env[ENV_KEY]
  })

  it('sin header X-Integration-Key → 401', async () => {
    const res = await POST(req({ body: payloadValido() }))
    expect(res.status).toBe(401)
  })

  it('con llave inválida → 401', async () => {
    const res = await POST(req({ headers: { 'x-integration-key': 'incorrecta' }, body: payloadValido() }))
    expect(res.status).toBe(401)
  })

  it('sin CUBICAJE_PEDIDOS_INTEGRATION_KEY configurada en el servidor → 401 aunque el header venga', async () => {
    delete process.env[ENV_KEY]
    const res = await POST(req({ headers: { 'x-integration-key': SECRETO }, body: payloadValido() }))
    expect(res.status).toBe(401)
  })

  it('con llave válida y body válido → 201 creado', async () => {
    const res = await POST(req({ headers: { 'x-integration-key': SECRETO }, body: payloadValido() }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('creado')
  })

  it('con llave válida y body inválido → 422 rechazado', async () => {
    const res = await POST(
      req({ headers: { 'x-integration-key': SECRETO }, body: payloadValido({ cantidadTotal: -5 }) })
    )
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.status).toBe('rechazado')
  })

  it('con JSON malformado → 400', async () => {
    const res = await POST(req({ headers: { 'x-integration-key': SECRETO }, body: '{ esto no es json' }))
    expect(res.status).toBe(400)
  })

  it('con payload que excede el tamaño máximo → 413', async () => {
    const productosGigantes = Array.from({ length: 1 }, () => ({
      sku: 'A'.repeat(60),
      condicion: 'GRB',
      cantidad: 1,
      relleno: 'x'.repeat(300 * 1024), // > 256KB, se filtrará igual por sanitización de claves si aplicara, pero aquí solo importa el tamaño
    }))
    const res = await POST(
      req({ headers: { 'x-integration-key': SECRETO }, body: payloadValido({ productos: productosGigantes }) })
    )
    expect(res.status).toBe(413)
  })

  it('no revela detalles internos si el repositorio truena', async () => {
    const dbModule = await import('@/lib/integration-cubicaje-db')
    dbModule.getColeccionesCubicaje.mockImplementationOnce(async () => {
      throw new Error('ECONNREFUSED mongodb://usuario:password@host/db secreto-interno')
    })
    const res = await POST(req({ headers: { 'x-integration-key': SECRETO }, body: payloadValido() }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.detalle).not.toMatch(/mongodb|password|ECONNREFUSED/i)
  })
})

describe('Métodos HTTP no permitidos', () => {
  // No agregamos handlers vacíos para GET/PUT/PATCH/DELETE solo para
  // "probarlos" — eso fabricaría un comportamiento que no existe. La forma
  // correcta de verificar esto es confirmar que el módulo de la ruta NO
  // exporta esos métodos: esa ausencia es exactamente lo que hace que
  // Next.js App Router responda 405 Method Not Allowed automáticamente
  // para cualquier método sin handler exportado en route.js.
  it('el módulo de la ruta no exporta GET/PUT/PATCH/DELETE (405 automático de Next.js)', () => {
    expect(rutaModulo.GET).toBeUndefined()
    expect(rutaModulo.PUT).toBeUndefined()
    expect(rutaModulo.PATCH).toBeUndefined()
    expect(rutaModulo.DELETE).toBeUndefined()
    expect(typeof rutaModulo.POST).toBe('function')
  })
})
