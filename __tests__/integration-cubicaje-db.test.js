import { beforeEach, describe, expect, it, vi } from 'vitest'

// Todas las pruebas de este archivo mockean lib/mongodb — en ningún
// momento se conecta a MongoDB real. `vi.resetModules()` + import
// dinámico en cada test da un módulo fresco (indicesAsegurados = false)
// para poder probar el estado inicial, el fallo, y el reintento posterior
// dentro de un mismo test cuando hace falta.

function crearColeccionFake(nombre, registroLlamadas, { fallarSiempreParaColeccion = null } = {}) {
  return {
    createIndex: vi.fn(async (spec, opts) => {
      registroLlamadas.push({ nombre, spec, opts })
      if (fallarSiempreParaColeccion && nombre === fallarSiempreParaColeccion) {
        throw new Error('connection lost to mongodb+srv://usuario:secreto@cluster.mongodb.net/db')
      }
      return `${nombre}_index_ok`
    }),
    findOne: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
  }
}

// `fallarSiempreParaColeccion`: a diferencia de un contador global de
// llamadas (que "se gasta" en el primer intento y deja pasar el
// reintento por casualidad), esto falla de forma persistente para esa
// colección en CADA intento — necesario para probar que un reintento
// genuino vuelve a fallar si el problema de fondo sigue ahí.
function crearDbFake(opts = {}) {
  const registroLlamadas = []
  const db = {
    collection: vi.fn((nombre) => crearColeccionFake(nombre, registroLlamadas, opts)),
  }
  return { db, registroLlamadas }
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('@/lib/mongodb')
})

describe('asegurarIndices / getColeccionesCubicaje — creación segura de índices', () => {
  it('creación exitosa de los 4 índices requeridos', async () => {
    const { db, registroLlamadas } = crearDbFake()
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')
    const colecciones = await getColeccionesCubicaje()

    expect(colecciones.pallets).toBeDefined()
    expect(colecciones.eventos).toBeDefined()
    expect(colecciones.syncStatus).toBeDefined()

    const nombresIndexados = registroLlamadas.map((l) => l.nombre)
    expect(nombresIndexados).toContain('integrationCubicajePallets')
    expect(nombresIndexados).toContain('integrationCubicajeEvents')
    expect(nombresIndexados).toContain('integrationCubicajeSyncStatus')
    expect(registroLlamadas.some((l) => l.opts?.unique === true && l.nombre === 'integrationCubicajePallets')).toBe(true)
    expect(registroLlamadas.some((l) => l.opts?.unique === true && l.nombre === 'integrationCubicajeEvents')).toBe(true)
  })

  it('índice ya existente con la misma definición no lanza error (createIndex es idempotente por diseño de Mongo)', async () => {
    // No hay "caso especial" que programar para esto: createIndex() con el
    // mismo spec simplemente resuelve sin error la segunda vez — se prueba
    // llamando getColeccionesCubicaje() dos veces contra el mismo fake sano.
    const { db } = crearDbFake()
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')
    await expect(getColeccionesCubicaje()).resolves.toBeDefined()
    await expect(getColeccionesCubicaje()).resolves.toBeDefined()
  })

  it('un error real al crear un índice se propaga (no se traga con .catch vacío)', async () => {
    const { db } = crearDbFake({ fallarSiempreParaColeccion: 'integrationCubicajeEvents' })
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')
    await expect(getColeccionesCubicaje()).rejects.toThrow()
  })

  it('el mensaje de error propagado no contiene la cadena de conexión ni credenciales', async () => {
    const { db } = crearDbFake({ fallarSiempreParaColeccion: 'integrationCubicajePallets' })
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')
    let errorCapturado = null
    try {
      await getColeccionesCubicaje()
    } catch (err) {
      errorCapturado = err
    }
    expect(errorCapturado).not.toBeNull()
    expect(errorCapturado.message).not.toMatch(/mongodb(\+srv)?:\/\/|usuario|secreto/i)
  })

  it('no marca indicesAsegurados tras un fallo: una solicitud posterior reintenta crear los índices de nuevo (y vuelve a fallar si el problema persiste)', async () => {
    const { db, registroLlamadas } = crearDbFake({ fallarSiempreParaColeccion: 'integrationCubicajeEvents' })
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')

    await expect(getColeccionesCubicaje()).rejects.toThrow()
    const llamadasTrasPrimerFallo = registroLlamadas.length
    expect(llamadasTrasPrimerFallo).toBe(2) // pallets (ok) + events (falla), se detiene ahí

    // Segunda solicitud sobre el MISMO módulo (mismo proceso): si
    // indicesAsegurados se hubiera marcado true por error, esta llamada no
    // volvería a invocar createIndex en absoluto. Como el índice nunca
    // quedó garantizado, debe reintentar desde el primero — y como el
    // problema de fondo sigue ahí (fallarSiempreParaColeccion), vuelve a
    // fallar de la misma forma, en vez de "colarse" como si ya estuviera listo.
    await expect(getColeccionesCubicaje()).rejects.toThrow()
    expect(registroLlamadas.length).toBe(llamadasTrasPrimerFallo * 2)
  })

  it('reintento correcto: tras un fallo transitorio, una solicitud posterior con Mongo sano sí funciona', async () => {
    let intentosCreateIndex = 0
    const db = {
      collection: vi.fn(() => ({
        createIndex: vi.fn(async () => {
          intentosCreateIndex += 1
          // Solo la primerísima llamada global falla (simula un blip de red).
          if (intentosCreateIndex === 1) throw new Error('fallo transitorio de conexión')
          return 'ok'
        }),
        findOne: vi.fn(),
        insertOne: vi.fn(),
        updateOne: vi.fn(),
      })),
    }
    vi.doMock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => db) }))

    const { getColeccionesCubicaje } = await import('@/lib/integration-cubicaje-db')

    await expect(getColeccionesCubicaje()).rejects.toThrow()
    await expect(getColeccionesCubicaje()).resolves.toBeDefined()
  })
})
