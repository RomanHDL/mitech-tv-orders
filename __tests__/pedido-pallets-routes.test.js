import { beforeEach, describe, expect, it, vi } from 'vitest'

// t() de identidad: los tests comparan contra la CLAVE de traducción, no
// contra el texto localizado — evita acoplar las pruebas a los JSON de
// idioma. Coincide con el patrón real: getServerT() siempre resuelve a una
// función t(clave, params).
vi.mock('@/lib/i18n-server', () => ({
  getServerT: vi.fn(async () => (clave) => clave),
}))

const mockGetUsuario = vi.fn()
const mockRequireModule = vi.fn()
vi.mock('@/lib/auth', () => ({
  getUsuario: (...args) => mockGetUsuario(...args),
  requireModule: (...args) => mockRequireModule(...args),
}))

// db fake configurable por test: cada colección resuelve lo que el test
// necesite via mockResolvedValueOnce / mockImplementationOnce.
const mockColeccionPedidos = {
  findOne: vi.fn(),
}
const mockColeccionPallets = {
  findOne: vi.fn(),
  find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
}
const mockGetDb = vi.fn(async () => ({
  collection: (nombre) => {
    if (nombre === 'pedidos') return mockColeccionPedidos
    if (nombre === 'integrationCubicajePallets') return mockColeccionPallets
    throw new Error(`Colección inesperada en el mock: ${nombre}`)
  },
}))
vi.mock('@/lib/mongodb', () => ({
  getDb: (...args) => mockGetDb(...args),
}))

const mockRepo = {
  buscarActivoPorPalletId: vi.fn(),
  listarPorPedido: vi.fn(async () => []),
  crear: vi.fn(),
  desactivar: vi.fn(),
}
const mockGetRepositorio = vi.fn(async () => mockRepo)
vi.mock('@/lib/integration-pedido-pallet-links-db', () => ({
  getRepositorioPedidoPalletLinks: (...args) => mockGetRepositorio(...args),
}))

const { GET: getPalletPorId } = await import('@/app/api/cubicaje-pallets/[palletId]/route')
const { GET: getPalletsDePedido } = await import('@/app/api/pedidos/[id]/pallets/route')
const { POST: postVincular } = await import('@/app/api/pedidos/[id]/pallets/vincular/route')
const { POST: postDesvincular } = await import('@/app/api/pedidos/[id]/pallets/[palletId]/desvincular/route')

const PEDIDO_ID = '507f1f77bcf86cd799439011' // ObjectId válido de 24 hex chars

function req(url, { method, body } = {}) {
  const metodoFinal = method || (body !== undefined ? 'POST' : 'GET')
  return new Request(url, {
    method: metodoFinal,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDb.mockImplementation(async () => ({
    collection: (nombre) => {
      if (nombre === 'pedidos') return mockColeccionPedidos
      if (nombre === 'integrationCubicajePallets') return mockColeccionPallets
      throw new Error(`Colección inesperada en el mock: ${nombre}`)
    },
  }))
  mockColeccionPallets.find.mockReturnValue({ toArray: vi.fn(async () => []) })
  mockGetRepositorio.mockResolvedValue(mockRepo)
  mockGetUsuario.mockResolvedValue({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
})

describe('GET /api/cubicaje-pallets/[palletId]', () => {
  it('pallet existente -> 200 con sus datos', async () => {
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1', cantidadTotal: 12 })
    const res = await getPalletPorId(req('http://localhost/api/cubicaje-pallets/P-1'), { params: { palletId: 'P-1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.palletId).toBe('P-1')
  })

  it('pallet inexistente -> 404', async () => {
    mockColeccionPallets.findOne.mockResolvedValueOnce(null)
    const res = await getPalletPorId(req('http://localhost/api/cubicaje-pallets/NO-EXISTE'), { params: { palletId: 'NO-EXISTE' } })
    expect(res.status).toBe(404)
  })

  it('error interno no filtra detalles', async () => {
    mockColeccionPallets.findOne.mockRejectedValueOnce(new Error('ECONNREFUSED mongodb+srv://user:pass@host/db'))
    const res = await getPalletPorId(req('http://localhost/api/cubicaje-pallets/P-1'), { params: { palletId: 'P-1' } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })

  it('la respuesta HTTP no incluye _id, ultimoEventId, payloadVersion ni campos internos del ERP', async () => {
    mockColeccionPallets.findOne.mockResolvedValueOnce({
      _id: 'mongo-id-interno',
      palletId: 'P-1',
      cantidadTotal: 12,
      productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5, numeroSerie: 'MTG7ST0413' }],
      ubicacion: 'REFM2',
      workcenter: 'Refurbish Monterrey 2',
      operador: 'nathalie.lopez',
      workOrderId: 116538,
      sourceOrderId: 'xxTRG CONSIGNMENT-2026-04-28-1',
      woType: 'PO',
      purchaseId: 1374637,
      activo: true,
      payloadVersion: 1,
      ultimoEventId: 'evt-123',
      lastSync: new Date('2026-07-30T00:00:00.000Z'),
      recibidoEn: new Date('2026-07-29T00:00:00.000Z'),
      actualizadoEn: new Date('2026-07-30T00:00:00.000Z'),
    })
    const res = await getPalletPorId(req('http://localhost/api/cubicaje-pallets/P-1'), { params: { palletId: 'P-1' } })
    const json = await res.json()
    expect(json._id).toBeUndefined()
    expect(json.ultimoEventId).toBeUndefined()
    expect(json.payloadVersion).toBeUndefined()
    expect(json.workOrderId).toBeUndefined()
    expect(json.sourceOrderId).toBeUndefined()
    expect(json.woType).toBeUndefined()
    expect(json.purchaseId).toBeUndefined()
    expect(json.recibidoEn).toBeUndefined()
    expect(json.actualizadoEn).toBeUndefined()
    expect(Object.keys(json).sort()).toEqual(
      ['activo', 'cantidadTotal', 'lastSync', 'operador', 'palletId', 'productos', 'ubicacion', 'workcenter'].sort()
    )
  })
})

describe('GET /api/pedidos/[id]/pallets', () => {
  it('pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  it('pedido existente sin pallets vinculados -> lista vacía', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ televisiones: [] })
    mockRepo.listarPorPedido.mockResolvedValueOnce([])
    const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vinculados).toEqual([])
  })

  it('pedido con un pallet vinculado incluye datos del pallet y discrepancias', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({
      televisiones: [{ modelo: 'SKU-A', condiciones: ['GRB'] }],
    })
    mockRepo.listarPorPedido.mockResolvedValueOnce([
      { palletId: 'P-1', vinculadoPor: 'u1', vinculadoPorNombre: 'Ana', vinculadoEn: new Date() },
    ])
    mockColeccionPallets.find.mockReturnValueOnce({
      toArray: vi.fn(async () => [{
        palletId: 'P-1', cantidadTotal: 5, ubicacion: 'REFM2', operador: 'nathalie',
        productos: [{ sku: 'SKU-DESCONOCIDO', condicion: 'GRB', cantidad: 5 }],
      }]),
    })
    const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
    const json = await res.json()
    expect(json.vinculados).toHaveLength(1)
    expect(json.vinculados[0].palletId).toBe('P-1')
    expect(json.vinculados[0].discrepancias).toHaveLength(1)
  })
})

describe('POST /api/pedidos/[id]/pallets/vincular', () => {
  it('id de pedido inválido -> 400', async () => {
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: 'no-valido' } })
    expect(res.status).toBe(400)
  })

  it('body con clave peligrosa -> 400', async () => {
    const res = await postVincular(
      req('http://localhost/x', { body: { palletId: 'P-1', $where: '1' } }),
      { params: { id: PEDIDO_ID } }
    )
    expect(res.status).toBe(400)
  })

  it('pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  it('capturista que no es dueño del pedido -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro-usuario', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('capturista dueño del pedido -> permitido, pallet inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockColeccionPallets.findOne.mockResolvedValueOnce(null)
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'NO-EXISTE' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  it('surtidor sin módulo picking -> rechazado con el status de requireModule', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
    mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('admin sin restricción -> vincula exitosamente', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce(null)
    mockRepo.crear.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: true })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('vinculado')
  })

  it('intento de vincular a otro pedido responde 409 (conflicto) de punta a punta', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'admin-1', numeroPedido: '24072026' })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ pedidoId: 'otro-pedido', palletId: 'P-1' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(409)
  })

  it('error interno no filtra detalles', async () => {
    mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('mongodb+srv://user:pass@host/db timeout'))
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })
})

describe('POST /api/pedidos/[id]/pallets/[palletId]/desvincular', () => {
  it('pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(404)
  })

  it('capturista que no es dueño -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('desvinculación exitosa (admin)', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1' })
    mockRepo.desactivar.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: false })
    const res = await postDesvincular(
      req('http://localhost/x', { body: { motivo: 'dañado' } }),
      { params: { id: PEDIDO_ID, palletId: 'P-1' } }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('desvinculado')
  })

  it('segunda desvinculación (ya inactivo) responde ya_desvinculado, no error', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce(null)
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ya_desvinculado')
  })

  it('body con clave peligrosa -> 400', async () => {
    const res = await postDesvincular(
      req('http://localhost/x', { body: { motivo: 'ok', $where: '1' } }),
      { params: { id: PEDIDO_ID, palletId: 'P-1' } }
    )
    expect(res.status).toBe(400)
  })

  it('error interno no filtra detalles', async () => {
    mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('mongodb+srv://user:pass@host/db timeout'))
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })
})
