import { describe, expect, it } from 'vitest'
import {
  compararSecretoEnTiempoConstante,
  contieneClavesPeligrosas,
  esFechaIso8601Valida,
  procesarPalletCubicaje,
  sanitizarMensajeError,
  serializarPalletPublico,
  validarPayloadPallet,
} from '@/lib/integration-cubicaje'

function payloadValido(overrides = {}) {
  return {
    eventId: 'evt-1',
    payloadVersion: 1,
    palletId: '389156-0015',
    cantidadTotal: 12,
    productos: [
      { sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5, numeroSerie: 'MTG7ST0413' },
      { sku: 'SNTV007319-GRB', condicion: 'GRB', cantidad: 1 },
    ],
    ubicacion: 'REFM2',
    workcenter: 'Refurbish Monterrey 2',
    operador: 'nathalie.lopez',
    workOrderId: 116538,
    sourceOrderId: 'xxTRG CONSIGNMENT-2026-04-28-1',
    woType: 'PO',
    purchaseId: 1374637,
    activo: true,
    lastSync: '2026-07-29T14:49:58.210Z',
    ...overrides,
  }
}

// ─── Fake en memoria del repositorio (no toca Mongo real) ──────────────

function crearRepoFake() {
  const pallets = new Map() // palletId -> { lastSync: Date, ...campos }
  const eventos = new Map() // eventId -> doc

  return {
    pallets: {
      async upsertSiMasNuevo({ palletId, lastSync, campos }, ahora) {
        const existente = pallets.get(palletId)
        if (!existente) {
          pallets.set(palletId, { palletId, lastSync, actualizadoEn: ahora, recibidoEn: ahora, ...campos })
          return 'creado'
        }
        if (lastSync > existente.lastSync) {
          pallets.set(palletId, { ...existente, lastSync, actualizadoEn: ahora, ...campos })
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
        if (eventos.has(doc.eventId)) {
          const err = new Error('duplicate key')
          err.code = 11000
          throw err
        }
        eventos.set(doc.eventId, doc)
        return { insertedId: doc.eventId }
      },
    },
    syncStatus: {
      calls: 0,
      async updateOne() {
        this.calls += 1
      },
    },
    _inspect: { pallets, eventos },
  }
}

describe('contieneClavesPeligrosas', () => {
  it('detecta claves que empiezan con $', () => {
    expect(contieneClavesPeligrosas({ $set: { x: 1 } })).toBe(true)
  })
  it('detecta claves con punto', () => {
    expect(contieneClavesPeligrosas({ 'a.b': 1 })).toBe(true)
  })
  it('detecta __proto__/constructor/prototype', () => {
    // { __proto__: {} } como literal de objeto NO crea una propiedad propia
    // (es sintaxis especial de JS) — el vector de ataque real es JSON.parse,
    // que sí crea una propiedad propia normal con esa clave literal.
    expect(contieneClavesPeligrosas(JSON.parse('{"__proto__":{}}'))).toBe(true)
    expect(contieneClavesPeligrosas({ constructor: {} })).toBe(true)
    expect(contieneClavesPeligrosas({ prototype: {} })).toBe(true)
  })
  it('detecta claves peligrosas anidadas dentro de arreglos', () => {
    expect(contieneClavesPeligrosas({ productos: [{ $where: '1' }] })).toBe(true)
  })
  it('no marca un payload normal como peligroso', () => {
    expect(contieneClavesPeligrosas(payloadValido())).toBe(false)
  })
})

describe('compararSecretoEnTiempoConstante', () => {
  it('true cuando coinciden', () => {
    expect(compararSecretoEnTiempoConstante('abc123', 'abc123')).toBe(true)
  })
  it('false cuando no coinciden', () => {
    expect(compararSecretoEnTiempoConstante('abc123', 'xyz789')).toBe(false)
  })
  it('false cuando difieren en longitud (no debe tronar)', () => {
    expect(compararSecretoEnTiempoConstante('a', 'abcdefghijk')).toBe(false)
  })
  it('false cuando falta alguno de los dos', () => {
    expect(compararSecretoEnTiempoConstante(null, 'abc')).toBe(false)
    expect(compararSecretoEnTiempoConstante('abc', undefined)).toBe(false)
    expect(compararSecretoEnTiempoConstante('', 'abc')).toBe(false)
  })
})

describe('esFechaIso8601Valida', () => {
  it('acepta formatos ISO-8601 completos válidos', () => {
    expect(esFechaIso8601Valida('2026-07-30T14:25:10Z')).toBe(true)
    expect(esFechaIso8601Valida('2026-07-30T14:25:10.123Z')).toBe(true)
    expect(esFechaIso8601Valida('2026-07-30T08:25:10-06:00')).toBe(true)
  })

  it('rechaza formatos no-ISO-8601 aunque Date los pueda parsear', () => {
    expect(esFechaIso8601Valida('July 29, 2026')).toBe(false)
    expect(esFechaIso8601Valida('2026/07/29')).toBe(false)
    expect(esFechaIso8601Valida('2026-07-30')).toBe(false) // solo fecha, sin hora
    expect(esFechaIso8601Valida('14:25:10')).toBe(false) // solo hora
  })

  it('rechaza basura, números, null y strings vacíos', () => {
    expect(esFechaIso8601Valida('no-es-fecha')).toBe(false)
    expect(esFechaIso8601Valida(1753900000000)).toBe(false)
    expect(esFechaIso8601Valida(null)).toBe(false)
    expect(esFechaIso8601Valida(undefined)).toBe(false)
    expect(esFechaIso8601Valida('')).toBe(false)
  })

  it('rechaza fechas imposibles que Date normalizaría en silencio', () => {
    // new Date('2026-02-30T00:00:00Z') NO truena — Date la rueda a marzo.
    // La validación por rango debe rechazarla explícitamente.
    expect(esFechaIso8601Valida('2026-02-30T00:00:00Z')).toBe(false)
    expect(esFechaIso8601Valida('2026-13-01T00:00:00Z')).toBe(false) // mes 13
    expect(esFechaIso8601Valida('2026-04-31T00:00:00Z')).toBe(false) // abril tiene 30 días
    expect(esFechaIso8601Valida('2026-07-30T24:00:00Z')).toBe(false) // hora 24
    expect(esFechaIso8601Valida('2026-07-30T14:60:00Z')).toBe(false) // minuto 60
  })

  it('respeta años bisiestos correctamente', () => {
    expect(esFechaIso8601Valida('2028-02-29T00:00:00Z')).toBe(true) // 2028 es bisiesto
    expect(esFechaIso8601Valida('2026-02-29T00:00:00Z')).toBe(false) // 2026 no es bisiesto
  })
})

describe('sanitizarMensajeError', () => {
  it('redacta cadenas de conexión mongodb:// y mongodb+srv:// con credenciales', () => {
    const err = new Error('connect ECONNREFUSED mongodb+srv://usuario:secreto123@cluster.mongodb.net/db')
    const msg = sanitizarMensajeError(err)
    expect(msg).not.toMatch(/usuario|secreto123|cluster\.mongodb\.net/)
    expect(msg).toContain('[redactado]')
  })

  it('deja intacto un mensaje sin cadena de conexión', () => {
    const err = new Error('timeout de red')
    expect(sanitizarMensajeError(err)).toBe('timeout de red')
  })
})

describe('validarPayloadPallet', () => {
  it('acepta un payload válido y normaliza numeroSerie ausente a null', () => {
    const r = validarPayloadPallet(payloadValido())
    expect(r.ok).toBe(true)
    expect(r.value.productos[1].numeroSerie).toBeNull()
    expect(r.value.lastSync).toBeInstanceOf(Date)
  })

  it('normaliza lastSync a representación UTC consistente sin importar el offset original', () => {
    const r = validarPayloadPallet(payloadValido({ lastSync: '2026-07-30T08:25:10-06:00' }))
    expect(r.ok).toBe(true)
    expect(r.value.lastSync.toISOString()).toBe('2026-07-30T14:25:10.000Z')
  })

  it('rechaza payloadVersion no soportado', () => {
    const r = validarPayloadPallet(payloadValido({ payloadVersion: 2 }))
    expect(r.ok).toBe(false)
    expect(r.status).toBe(422)
  })

  it('rechaza cantidadTotal negativa', () => {
    const r = validarPayloadPallet(payloadValido({ cantidadTotal: -1 }))
    expect(r.ok).toBe(false)
  })

  it('rechaza productos vacío', () => {
    const r = validarPayloadPallet(payloadValido({ productos: [] }))
    expect(r.ok).toBe(false)
  })

  it('rechaza productos que exceden el máximo permitido', () => {
    const productos = Array.from({ length: 201 }, (_, i) => ({
      sku: `SKU${i}`,
      condicion: 'GRB',
      cantidad: 1,
    }))
    const r = validarPayloadPallet(payloadValido({ productos }))
    expect(r.ok).toBe(false)
  })

  it('rechaza cantidad de producto no entera o <= 0', () => {
    expect(validarPayloadPallet(payloadValido({
      productos: [{ sku: 'A', condicion: 'GRB', cantidad: 0 }],
    })).ok).toBe(false)
    expect(validarPayloadPallet(payloadValido({
      productos: [{ sku: 'A', condicion: 'GRB', cantidad: 1.5 }],
    })).ok).toBe(false)
  })

  it('rechaza lastSync inválido en todos los formatos no-ISO-8601 esperados', () => {
    const invalidos = [
      'July 29, 2026',
      '2026/07/29',
      '2026-07-30',
      '14:25:10',
      'no-es-fecha',
      123456789,
      null,
      '',
    ]
    for (const lastSync of invalidos) {
      const r = validarPayloadPallet(payloadValido({ lastSync }))
      expect(r.ok, `lastSync=${JSON.stringify(lastSync)} debería rechazarse`).toBe(false)
    }
  })

  it('rechaza lastSync con fecha imposible (Date la normalizaría en silencio)', () => {
    const r = validarPayloadPallet(payloadValido({ lastSync: '2026-02-30T00:00:00Z' }))
    expect(r.ok).toBe(false)
  })

  it('rechaza payload con claves peligrosas antes de validar tipos', () => {
    const r = validarPayloadPallet({ ...payloadValido(), $where: '1' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('rechaza body que no es un objeto', () => {
    expect(validarPayloadPallet(null).ok).toBe(false)
    expect(validarPayloadPallet([]).ok).toBe(false)
    expect(validarPayloadPallet('x').ok).toBe(false)
  })
})

describe('procesarPalletCubicaje — idempotencia', () => {
  it('primer envío de un pallet nuevo → creado', async () => {
    const repo = crearRepoFake()
    const { value } = validarPayloadPallet(payloadValido())
    const r = await procesarPalletCubicaje(repo, value)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('creado')
  })

  it('reenviar el mismo pallet con el mismo lastSync no duplica ni crea de nuevo', async () => {
    const repo = crearRepoFake()
    const { value: v1 } = validarPayloadPallet(payloadValido({ eventId: 'evt-1' }))
    await procesarPalletCubicaje(repo, v1)

    const { value: v2 } = validarPayloadPallet(payloadValido({ eventId: 'evt-2' }))
    const r2 = await procesarPalletCubicaje(repo, v2)
    expect(r2.body.status).toBe('ignorado_desactualizado')
    expect(repo._inspect.pallets.size).toBe(1)
  })

  it('cantidad 12 → 10 actualiza el snapshot, no suma', async () => {
    const repo = crearRepoFake()
    const { value: v1 } = validarPayloadPallet(payloadValido({ eventId: 'evt-1', cantidadTotal: 12 }))
    await procesarPalletCubicaje(repo, v1)

    const { value: v2 } = validarPayloadPallet(payloadValido({
      eventId: 'evt-2',
      cantidadTotal: 10,
      lastSync: '2026-07-30T10:00:00.000Z', // más nuevo
      productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 10 }],
    }))
    const r2 = await procesarPalletCubicaje(repo, v2)
    expect(r2.body.status).toBe('actualizado')

    const doc = repo._inspect.pallets.get('389156-0015')
    expect(doc.cantidadTotal).toBe(10)
    expect(doc.productos).toHaveLength(1)
    expect(doc.productos[0].cantidad).toBe(10)
  })

  it('evento con lastSync anterior al almacenado se ignora sin sobrescribir', async () => {
    const repo = crearRepoFake()
    const { value: v1 } = validarPayloadPallet(payloadValido({
      eventId: 'evt-1',
      lastSync: '2026-07-30T10:00:00.000Z',
      cantidadTotal: 10,
    }))
    await procesarPalletCubicaje(repo, v1)

    const { value: v2 } = validarPayloadPallet(payloadValido({
      eventId: 'evt-2',
      lastSync: '2026-07-29T00:00:00.000Z', // anterior (fuera de orden)
      cantidadTotal: 999,
    }))
    const r2 = await procesarPalletCubicaje(repo, v2)
    expect(r2.body.status).toBe('ignorado_desactualizado')

    const doc = repo._inspect.pallets.get('389156-0015')
    expect(doc.cantidadTotal).toBe(10) // no se sobrescribió con el evento viejo
  })

  it('el mismo eventId reenviado responde igual sin reprocesar ni recontar', async () => {
    const repo = crearRepoFake()
    const { value } = validarPayloadPallet(payloadValido({ eventId: 'evt-repetido' }))

    const r1 = await procesarPalletCubicaje(repo, value)
    const r2 = await procesarPalletCubicaje(repo, value)

    expect(r1.repetido).toBe(false)
    expect(r2.repetido).toBe(true)
    expect(r2.body).toEqual(r1.body)
    expect(repo._inspect.eventos.size).toBe(1)
  })

  it('dos pallets distintos vinculables al mismo pedido no chocan entre sí', async () => {
    const repo = crearRepoFake()
    const { value: a } = validarPayloadPallet(payloadValido({ eventId: 'evt-a', palletId: 'PALLET-A' }))
    const { value: b } = validarPayloadPallet(payloadValido({ eventId: 'evt-b', palletId: 'PALLET-B' }))
    const ra = await procesarPalletCubicaje(repo, a)
    const rb = await procesarPalletCubicaje(repo, b)
    expect(ra.body.status).toBe('creado')
    expect(rb.body.status).toBe('creado')
    expect(repo._inspect.pallets.size).toBe(2)
  })

  // Regla vigente v1 (documentada también en lib/integration-cubicaje.js,
  // justo antes de MENSAJES_RESULTADO): un lastSync IGUAL al almacenado se
  // ignora siempre, sin importar si el contenido cambió. No se compara
  // contenido, solo la marca temporal.
  it('lastSync igual al almacenado pero con contenido distinto también se ignora (regla determinista vigente)', async () => {
    const repo = crearRepoFake()
    const { value: v1 } = validarPayloadPallet(payloadValido({
      eventId: 'evt-1',
      lastSync: '2026-07-30T10:00:00.000Z',
      cantidadTotal: 12,
    }))
    await procesarPalletCubicaje(repo, v1)

    const { value: v2 } = validarPayloadPallet(payloadValido({
      eventId: 'evt-2',
      lastSync: '2026-07-30T10:00:00.000Z', // mismo lastSync exacto
      cantidadTotal: 999, // contenido claramente distinto
      productos: [{ sku: 'OTRO-SKU', condicion: 'GRC', cantidad: 1 }],
    }))
    const r2 = await procesarPalletCubicaje(repo, v2)
    expect(r2.body.status).toBe('ignorado_desactualizado')

    const doc = repo._inspect.pallets.get('389156-0015')
    expect(doc.cantidadTotal).toBe(12) // el contenido distinto de v2 nunca se aplicó
  })

  describe('activo:false (desactivación, sin borrar historial)', () => {
    it('desactivar un pallet actualiza el snapshot sin eliminarlo, registra el evento, y un evento viejo con activo:true no lo reactiva', async () => {
      const repo = crearRepoFake()

      // 1) Snapshot inicial: activo:true
      const { value: v1 } = validarPayloadPallet(payloadValido({
        eventId: 'evt-activo-1',
        lastSync: '2026-07-29T10:00:00.000Z',
        activo: true,
      }))
      const r1 = await procesarPalletCubicaje(repo, v1)
      expect(r1.body.status).toBe('creado')
      expect(repo._inspect.pallets.get('389156-0015').activo).toBe(true)

      // 2) Evento posterior: activo:false (desactivación real)
      const { value: v2 } = validarPayloadPallet(payloadValido({
        eventId: 'evt-desactivar',
        lastSync: '2026-07-30T10:00:00.000Z', // posterior a v1
        activo: false,
        cantidadTotal: 12,
        productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5, numeroSerie: 'MTG7ST0413' }],
      }))
      const r2 = await procesarPalletCubicaje(repo, v2)
      expect(r2.body.status).toBe('actualizado')

      const docTrasDesactivar = repo._inspect.pallets.get('389156-0015')
      // El snapshot canónico queda con activo:false...
      expect(docTrasDesactivar.activo).toBe(false)
      // ...el documento NO se elimina...
      expect(repo._inspect.pallets.has('389156-0015')).toBe(true)
      // ...y los productos/información del snapshot vigente siguen disponibles.
      expect(docTrasDesactivar.productos).toHaveLength(1)
      expect(docTrasDesactivar.productos[0].sku).toBe('SNTV007618-GRB')

      // El evento de desactivación quedó registrado en integrationCubicajeEvents (fake).
      const eventoDesactivacion = repo._inspect.eventos.get('evt-desactivar')
      expect(eventoDesactivacion).toBeDefined()
      expect(eventoDesactivacion.resultado).toBe('actualizado')

      // 3) Reenviar el mismo eventId de desactivación no duplica el evento.
      const r2Repetido = await procesarPalletCubicaje(repo, v2)
      expect(r2Repetido.repetido).toBe(true)
      expect(repo._inspect.eventos.size).toBe(2) // evt-activo-1 + evt-desactivar, no 3

      // 4) Un evento viejo (lastSync anterior a ambos) con activo:true no reactiva el pallet.
      const { value: v3 } = validarPayloadPallet(payloadValido({
        eventId: 'evt-reactivar-viejo',
        lastSync: '2026-07-28T10:00:00.000Z', // anterior a v1 y v2
        activo: true,
      }))
      const r3 = await procesarPalletCubicaje(repo, v3)
      expect(r3.body.status).toBe('ignorado_desactualizado')

      const docFinal = repo._inspect.pallets.get('389156-0015')
      expect(docFinal.activo).toBe(false) // sigue desactivado, no se reactivó
    })
  })
})

describe('serializarPalletPublico', () => {
  function palletCrudo(overrides = {}) {
    return {
      _id: 'mongo-object-id-interno',
      palletId: '389156-0015',
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
      ultimoEventId: 'evt-interno-123',
      lastSync: new Date('2026-07-30T00:00:00.000Z'),
      recibidoEn: new Date('2026-07-29T00:00:00.000Z'),
      actualizadoEn: new Date('2026-07-30T00:00:00.000Z'),
      ...overrides,
    }
  }

  it('contiene solamente los campos permitidos', () => {
    const publico = serializarPalletPublico(palletCrudo())
    expect(Object.keys(publico).sort()).toEqual(
      ['activo', 'cantidadTotal', 'lastSync', 'operador', 'palletId', 'productos', 'ubicacion', 'workcenter'].sort()
    )
  })

  it('no incluye _id', () => {
    const publico = serializarPalletPublico(palletCrudo())
    expect(publico._id).toBeUndefined()
  })

  it('no incluye ultimoEventId ni payloadVersion', () => {
    const publico = serializarPalletPublico(palletCrudo())
    expect(publico.ultimoEventId).toBeUndefined()
    expect(publico.payloadVersion).toBeUndefined()
  })

  it('no incluye workOrderId, sourceOrderId, woType, purchaseId, recibidoEn ni actualizadoEn', () => {
    const publico = serializarPalletPublico(palletCrudo())
    expect(publico.workOrderId).toBeUndefined()
    expect(publico.sourceOrderId).toBeUndefined()
    expect(publico.woType).toBeUndefined()
    expect(publico.purchaseId).toBeUndefined()
    expect(publico.recibidoEn).toBeUndefined()
    expect(publico.actualizadoEn).toBeUndefined()
  })

  it('campos internos inesperados agregados al documento no se filtran accidentalmente (whitelist, no blacklist)', () => {
    const publico = serializarPalletPublico(palletCrudo({ secretoFuturo: 'no-deberia-salir', otraCosaInterna: 42 }))
    expect(publico.secretoFuturo).toBeUndefined()
    expect(publico.otraCosaInterna).toBeUndefined()
  })

  it('normaliza cada producto a solo sku/condicion/cantidad/numeroSerie', () => {
    const publico = serializarPalletPublico(palletCrudo({
      productos: [{ sku: 'A', condicion: 'GRB', cantidad: 1, campoInterno: 'x' }],
    }))
    expect(Object.keys(publico.productos[0]).sort()).toEqual(['cantidad', 'condicion', 'numeroSerie', 'sku'].sort())
  })
})
