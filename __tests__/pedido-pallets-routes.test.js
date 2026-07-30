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
const { GET: getProgreso } = await import('@/app/api/pedidos/[id]/pallets/progreso/route')

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

  describe('autorización — armonizada con /progreso', () => {
    it('1. admin puede consultar cualquier pedido', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'cualquiera', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('2. capturista dueño puede consultar', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('3. capturista no dueño recibe 403', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('4. capturista sin módulo orders recibe 403', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('5. surtidor con picking puede consultar', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('6. surtidor sin picking recibe 403', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
      mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('7. usuario no autenticado recibe 401', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce(null)
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(401)
    })

    it('rol desconocido recibe 403', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', televisiones: [] })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-9', nombre: 'Fantasma', rol: 'fantasma' })
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('8. pedido inexistente devuelve 404 (antes de evaluar autorización)', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(404)
    })

    it('9. ID inválido devuelve 400', async () => {
      const res = await getPalletsDePedido(req('http://localhost/x'), { params: { id: 'no-es-un-objectid' } })
      expect(res.status).toBe(400)
    })

    it('10. la respuesta sigue siendo whitelisted (solo vinculados[])', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'admin-1', televisiones: [] })
      mockRepo.listarPorPedido.mockResolvedValueOnce([])
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      const json = await res.json()
      expect(Object.keys(json)).toEqual(['vinculados'])
    })

    it('11. errores internos no exponen MongoDB ni cadenas de conexión', async () => {
      mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('ECONNREFUSED mongodb+srv://user:pass@host/db'))
      const res = await getPalletsDePedido(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).not.toMatch(/mongodb|user:pass/i)
    })
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

  it('2. capturista dueño con módulo orders -> permitido (vincula exitosamente)', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce(null)
    mockRepo.crear.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: true })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(201)
  })

  it('capturista dueño del pedido, pallet inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockColeccionPallets.findOne.mockResolvedValueOnce(null)
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'NO-EXISTE' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  it('4. capturista sin módulo orders -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('5. surtidor con módulo picking -> permitido (vincula exitosamente)', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce(null)
    mockRepo.crear.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: true })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(201)
  })

  it('6. surtidor sin módulo picking -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
    mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('7. usuario sin cookie (getUsuario null) -> 401', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce(null)
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(401)
  })

  it('8. rol desconocido -> 403 (nunca se trata implícitamente como admin)', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-9', nombre: 'Fantasma', rol: 'fantasma' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('1. admin sin restricción -> vincula exitosamente', async () => {
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

  it('9. pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  it('10. pedidoId inválido -> 400', async () => {
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: 'no-valido' } })
    expect(res.status).toBe(400)
  })

  it('12. el middleware no sustituye la autorización del handler: aunque la ruta pase el middleware (POST exacto, capturista/surtidor autorizados por regex), el handler igual rechaza si no cumple ownership/módulo', async () => {
    // middleware.js ya permite POST a esta ruta exacta para capturista/surtidor
    // (ver __tests__/middleware.test.js) — esta prueba confirma que ESE paso
    // por middleware no es suficiente: el handler vuelve a exigir ownership.
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro-usuario-distinto', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(403)
  })

  it('el pedido se obtiene por el ID de la URL, nunca del body — pedidoId en el body no tiene efecto', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'admin-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce(null)
    mockRepo.crear.mockImplementationOnce(async (doc) => ({ ...doc, _id: 'id-1' }))
    const otroPedidoId = '507f1f77bcf86cd799439099'
    const res = await postVincular(
      req('http://localhost/x', { body: { palletId: 'P-1', pedidoId: otroPedidoId } }),
      { params: { id: PEDIDO_ID } }
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    // El link se creó con el ID de la URL, no con el pedidoId inyectado en el body.
    expect(json.link.pedidoId).toBe(PEDIDO_ID)
    expect(json.link.pedidoId).not.toBe(otroPedidoId)
  })

  it('intento de vincular a otro pedido responde 409 (conflicto) de punta a punta', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'admin-1', numeroPedido: '24072026' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
    mockColeccionPallets.findOne.mockResolvedValueOnce({ palletId: 'P-1' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ pedidoId: 'otro-pedido', palletId: 'P-1' })
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(409)
  })

  it('11. error interno no filtra detalles', async () => {
    mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('mongodb+srv://user:pass@host/db timeout'))
    const res = await postVincular(req('http://localhost/x', { body: { palletId: 'P-1' } }), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })
})

describe('POST /api/pedidos/[id]/pallets/[palletId]/desvincular', () => {
  it('9. pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(404)
  })

  it('10. pedidoId inválido -> 400', async () => {
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: 'no-valido', palletId: 'P-1' } })
    expect(res.status).toBe(400)
  })

  it('3. capturista que no es dueño -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('2. capturista dueño con módulo orders -> permitido', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1' })
    mockRepo.desactivar.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: false })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(200)
  })

  it('4. capturista sin módulo orders -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('5. surtidor con módulo picking -> permitido', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1' })
    mockRepo.desactivar.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: false })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(200)
  })

  it('6. surtidor sin módulo picking -> 403', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
    mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('7. usuario sin cookie (getUsuario null) -> 401', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce(null)
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(401)
  })

  it('8. rol desconocido -> 403 (nunca se trata implícitamente como admin)', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-9', nombre: 'Fantasma', rol: 'fantasma' })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('1. admin -> desvinculación exitosa', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
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

  it('12. el middleware no sustituye la autorización del handler: capturista no dueño sigue siendo rechazado aunque el middleware ya haya permitido llegar aquí', async () => {
    // middleware.js ya permite POST a esta ruta exacta para capturista
    // (ver __tests__/middleware.test.js) — esta prueba confirma que ESE
    // paso por middleware no es suficiente: el handler vuelve a exigir ownership.
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'otro-usuario-distinto' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
    mockRequireModule.mockResolvedValueOnce({ ok: true })
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(403)
  })

  it('el pedido se obtiene por el ID de la URL, nunca del body', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'admin-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
    mockRepo.buscarActivoPorPalletId.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1' })
    mockRepo.desactivar.mockResolvedValueOnce({ _id: 'id-1', pedidoId: PEDIDO_ID, palletId: 'P-1', activo: false })
    const otroPedidoId = '507f1f77bcf86cd799439099'
    const res = await postDesvincular(
      req('http://localhost/x', { body: { pedidoId: otroPedidoId } }),
      { params: { id: PEDIDO_ID, palletId: 'P-1' } }
    )
    expect(res.status).toBe(200)
    // findOne del pedido se llamó con el ID de la URL, no con el del body.
    expect(mockColeccionPedidos.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.anything() }),
      expect.anything()
    )
  })

  it('segunda desvinculación (ya inactivo) responde ya_desvinculado, no error', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({ creadoPor: 'user-1' })
    mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
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

  it('11. error interno no filtra detalles', async () => {
    mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('mongodb+srv://user:pass@host/db timeout'))
    const res = await postDesvincular(req('http://localhost/x', { body: {} }), { params: { id: PEDIDO_ID, palletId: 'P-1' } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })
})

describe('GET /api/pedidos/[id]/pallets/progreso', () => {
  it('20. error interno no filtra detalles (Mongo/credenciales)', async () => {
    mockColeccionPedidos.findOne.mockRejectedValueOnce(new Error('ECONNREFUSED mongodb+srv://user:pass@host/db'))
    const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toMatch(/mongodb|user:pass/i)
  })

  it('pedido inexistente -> 404', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce(null)
    const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(404)
  })

  describe('21. permisos y ownership', () => {
    it('capturista dueño del pedido -> permitido (200)', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'user-1', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('capturista que NO es dueño del pedido -> 403 (protección IDOR)', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'otro-usuario', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('capturista sin módulo orders -> rechazado con el status de requireModule', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'user-1', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-1', nombre: 'Ana', rol: 'capturista' })
      mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('surtidor con módulo picking -> permitido (200)', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'otro', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
      mockRequireModule.mockResolvedValueOnce({ ok: true })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('surtidor sin módulo picking -> rechazado', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'otro', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-2', nombre: 'Nathalie', rol: 'surtidor' })
      mockRequireModule.mockResolvedValueOnce({ ok: false, status: 403, error: 'sin permiso' })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('admin sin restricción -> permitido, sin importar quién creó el pedido', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'cualquiera', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'admin-1', nombre: 'Admin', rol: 'admin' })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(200)
    })

    it('7. usuario no autenticado recibe 401', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'user-1', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce(null)
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(401)
    })

    it('rol desconocido recibe 403', async () => {
      mockColeccionPedidos.findOne.mockResolvedValueOnce({
        creadoPor: 'user-1', numeroPedido: '24072026', cantidadTotal: 140, televisiones: [],
      })
      mockGetUsuario.mockResolvedValueOnce({ userId: 'user-9', nombre: 'Fantasma', rol: 'fantasma' })
      const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
      expect(res.status).toBe(403)
    })

    it('9. ID inválido devuelve 400', async () => {
      const res = await getProgreso(req('http://localhost/x'), { params: { id: 'no-es-un-objectid' } })
      expect(res.status).toBe(400)
    })
  })

  it('22. respuesta whitelisted: solo los campos esperados, sin documentos Mongo crudos', async () => {
    mockColeccionPedidos.findOne.mockResolvedValueOnce({
      creadoPor: 'admin-1',
      numeroPedido: '24072026',
      cantidadTotal: 140,
      televisiones: [{ modelo: 'SNTV007618', condiciones: ['GRB'], cantidad: 80, cantidadSurtida: 24 }],
    })
    mockRepo.listarPorPedido.mockResolvedValueOnce([
      { _id: 'link-interno', pedidoId: PEDIDO_ID, palletId: 'A', activo: true, vinculadoPor: 'u1' },
    ])
    mockColeccionPallets.find.mockReturnValueOnce({
      toArray: vi.fn(async () => [{
        _id: 'mongo-id-interno',
        palletId: 'A',
        activo: true,
        payloadVersion: 1,
        ultimoEventId: 'evt-1',
        productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }],
      }]),
    })
    const res = await getProgreso(req(`http://localhost/api/pedidos/${PEDIDO_ID}/pallets/progreso`), { params: { id: PEDIDO_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Object.keys(json).sort()).toEqual(
      ['actualizadoEn', 'advertencias', 'discrepancias', 'lineas', 'numeroPedido', 'pedidoId', 'resumen'].sort()
    )
    expect(json._id).toBeUndefined()
    // Nada del documento interno del pallet (payloadVersion, ultimoEventId, _id) se filtra al resumen/lineas.
    expect(JSON.stringify(json)).not.toMatch(/payloadVersion|ultimoEventId|mongo-id-interno|link-interno/)
    expect(json.resumen.cantidadSincronizadaValida).toBe(12)
  })
})
