import { describe, expect, it } from 'vitest'
import {
  desvincularPallet,
  detectarDiscrepanciasBasicas,
  normalizarCondicion,
  normalizarSku,
  normalizarSkuPallet,
  validarDesvincularInput,
  validarVincularInput,
  vincularPallet,
} from '@/lib/integration-pedido-pallet-links'

// ─── Fake en memoria del repositorio (no toca Mongo real) ──────────────
function crearRepoFake() {
  const docs = new Map()
  let contador = 0

  return {
    async buscarActivoPorPalletId(palletId) {
      for (const doc of docs.values()) {
        if (doc.palletId === palletId && doc.activo) return doc
      }
      return null
    },
    async crear(doc) {
      // Simula el índice único parcial (palletId, activo:true): si ya existe
      // un documento activo con este palletId, lanza E11000 como Mongo.
      for (const existente of docs.values()) {
        if (existente.palletId === doc.palletId && existente.activo) {
          const err = new Error('duplicate key')
          err.code = 11000
          throw err
        }
      }
      contador += 1
      const _id = `id-${contador}`
      const guardado = { ...doc, _id }
      docs.set(_id, guardado)
      return guardado
    },
    async desactivar(id, campos) {
      const doc = docs.get(id)
      const actualizado = { ...doc, ...campos, activo: false }
      docs.set(id, actualizado)
      return actualizado
    },
    _inspect: docs,
  }
}

function usuarioCapturista() {
  return { userId: 'user-1', nombre: 'Ana Capturista', rol: 'capturista' }
}

describe('validarVincularInput', () => {
  it('acepta un palletId válido', () => {
    const r = validarVincularInput({ palletId: '389156-0015' })
    expect(r.ok).toBe(true)
    expect(r.value.palletId).toBe('389156-0015')
  })

  it('recorta espacios', () => {
    const r = validarVincularInput({ palletId: '  389156-0015  ' })
    expect(r.value.palletId).toBe('389156-0015')
  })

  it('rechaza palletId vacío, ausente o no-string', () => {
    expect(validarVincularInput({ palletId: '' }).ok).toBe(false)
    expect(validarVincularInput({}).ok).toBe(false)
    expect(validarVincularInput({ palletId: 123 }).ok).toBe(false)
    expect(validarVincularInput({ palletId: '   ' }).ok).toBe(false)
  })

  it('rechaza body que no es objeto', () => {
    expect(validarVincularInput(null).ok).toBe(false)
    expect(validarVincularInput([]).ok).toBe(false)
    expect(validarVincularInput('x').ok).toBe(false)
  })

  it('rechaza claves Mongo peligrosas', () => {
    const r = validarVincularInput({ palletId: 'X', $where: '1' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('rechaza claves peligrosas anidadas y __proto__ vía JSON.parse', () => {
    const body = JSON.parse('{"palletId":"X","__proto__":{"x":1}}')
    expect(validarVincularInput(body).ok).toBe(false)
  })
})

describe('validarDesvincularInput', () => {
  it('acepta body vacío/ausente (motivo opcional)', () => {
    expect(validarDesvincularInput(undefined)).toEqual({ ok: true, value: { motivo: null } })
    expect(validarDesvincularInput(null)).toEqual({ ok: true, value: { motivo: null } })
    expect(validarDesvincularInput('')).toEqual({ ok: true, value: { motivo: null } })
  })

  it('acepta un motivo string válido', () => {
    const r = validarDesvincularInput({ motivo: 'Se canceló el pallet físicamente' })
    expect(r.ok).toBe(true)
    expect(r.value.motivo).toBe('Se canceló el pallet físicamente')
  })

  it('rechaza motivo no-string o demasiado largo', () => {
    expect(validarDesvincularInput({ motivo: 123 }).ok).toBe(false)
    expect(validarDesvincularInput({ motivo: 'x'.repeat(501) }).ok).toBe(false)
  })

  it('rechaza claves peligrosas', () => {
    expect(validarDesvincularInput({ motivo: 'ok', $set: { x: 1 } }).ok).toBe(false)
  })
})

describe('normalizarSku / normalizarCondicion', () => {
  it('recorta espacios y convierte a mayúsculas', () => {
    expect(normalizarSku('  sntv007618-grb  ')).toBe('SNTV007618-GRB')
    expect(normalizarCondicion('  grb  ')).toBe('GRB')
  })
  it('valores no-string se normalizan a cadena vacía', () => {
    expect(normalizarSku(null)).toBe('')
    expect(normalizarSku(undefined)).toBe('')
    expect(normalizarCondicion(123)).toBe('')
  })
})

describe('normalizarSkuPallet', () => {
  it('quita el sufijo "-{condicion}" cuando coincide exactamente (mayúsculas/minúsculas y espacios)', () => {
    expect(normalizarSkuPallet('sntv007618-grb', 'grb')).toBe('SNTV007618')
    expect(normalizarSkuPallet('  SNTV007618-GRB  ', '  GRB  ')).toBe('SNTV007618')
  })

  it('NO elimina un sufijo que no coincide exactamente con la condición (caso 5)', () => {
    // "ABC-123" con condición GRB: el sufijo real es "-123", no "-GRB".
    expect(normalizarSkuPallet('ABC-123', 'GRB')).toBe('ABC-123')
  })

  it('NO trunca incorrectamente cuando la condición aparece en medio del SKU (caso 6)', () => {
    // "MODELO-GRB-X" con condición GRB: el sufijo real es "-X", no "-GRB".
    expect(normalizarSkuPallet('MODELO-GRB-X', 'GRB')).toBe('MODELO-GRB-X')
  })

  it('sin condición informada, no altera el SKU (solo normaliza mayúsculas/espacios)', () => {
    expect(normalizarSkuPallet('sntv007618', '')).toBe('SNTV007618')
    expect(normalizarSkuPallet('sntv007618', null)).toBe('SNTV007618')
  })

  it('no elimina el sufijo si el SKU es igual al propio sufijo (evita dejarlo vacío)', () => {
    expect(normalizarSkuPallet('-GRB', 'GRB')).toBe('-GRB')
  })
})

describe('detectarDiscrepanciasBasicas', () => {
  // Fixture realista: el pedido guarda `modelo` SIN guiones (SKU_REGEX no
  // los permite), Cubicaje reporta el SKU CON la condición como sufijo.
  const pedido = {
    televisiones: [
      { modelo: 'SNTV007618', condiciones: ['GRB', 'GRA'] }, // varias condiciones permitidas
      { modelo: 'SNTV007319', condicion: 'GRB' }, // formato legado (condicion string)
    ],
  }

  it('1. Pedido SNTV007618+GRB contra pallet SNTV007618-GRB+GRB → sin discrepancia', () => {
    const productos = [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5 }]
    expect(detectarDiscrepanciasBasicas(pedido, productos)).toEqual([])
  })

  it('2. Mismos valores en minúsculas y con espacios → sin discrepancia', () => {
    const productos = [{ sku: '  sntv007618-grb  ', condicion: '  grb  ', cantidad: 5 }]
    expect(detectarDiscrepanciasBasicas(pedido, productos)).toEqual([])
  })

  it('3. Pedido SNTV007618+GRB contra pallet SNTV007618-GRC+GRC → discrepancia (condición no solicitada)', () => {
    const productos = [{ sku: 'SNTV007618-GRC', condicion: 'GRC', cantidad: 1 }]
    const r = detectarDiscrepanciasBasicas(pedido, productos)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ motivo: 'no_solicitado' })
  })

  it('4. Pedido SNTV007618+GRB contra pallet OTROSKU-GRB+GRB → discrepancia (SKU no solicitado)', () => {
    const productos = [{ sku: 'OTROSKU-GRB', condicion: 'GRB', cantidad: 1 }]
    const r = detectarDiscrepanciasBasicas(pedido, productos)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ sku: 'OTROSKU-GRB', motivo: 'no_solicitado' })
  })

  it('5. SKU ABC-123 con condición GRB no solicitada → discrepancia, sin corromper el SKU al reportarlo', () => {
    const productos = [{ sku: 'ABC-123', condicion: 'GRB', cantidad: 1 }]
    const r = detectarDiscrepanciasBasicas(pedido, productos)
    expect(r).toHaveLength(1)
    expect(r[0].sku).toBe('ABC-123') // se reporta tal cual, "-123" nunca se interpretó como sufijo de condición
  })

  it('6. SKU MODELO-GRB-X no debe truncarse ni confundirse con un SKU solicitado', () => {
    const productos = [{ sku: 'MODELO-GRB-X', condicion: 'GRB', cantidad: 1 }]
    const r = detectarDiscrepanciasBasicas(pedido, productos)
    expect(r).toHaveLength(1)
    expect(r[0].sku).toBe('MODELO-GRB-X')
  })

  it('7. Línea con varias condiciones permitidas acepta cualquiera de ellas', () => {
    const productosGRB = [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 1 }]
    const productosGRA = [{ sku: 'SNTV007618-GRA', condicion: 'GRA', cantidad: 1 }]
    expect(detectarDiscrepanciasBasicas(pedido, productosGRB)).toEqual([])
    expect(detectarDiscrepanciasBasicas(pedido, productosGRA)).toEqual([])
  })

  it('8. SKU de último momento (esUltimoMomento en la línea del pedido) se trata como línea normal', () => {
    const pedidoConUltimoMomento = {
      televisiones: [
        ...pedido.televisiones,
        { modelo: 'SNTV009999', condiciones: ['GRB'], esUltimoMomento: true, agregadoPorNombre: 'Ana' },
      ],
    }
    const productos = [{ sku: 'SNTV009999-GRB', condicion: 'GRB', cantidad: 1 }]
    expect(detectarDiscrepanciasBasicas(pedidoConUltimoMomento, productos)).toEqual([])
  })

  it('9. Producto sin condición informada se reporta explícitamente (no se descarta en silencio)', () => {
    const productos = [{ sku: 'SNTV007618', condicion: '', cantidad: 1 }]
    const r = detectarDiscrepanciasBasicas(pedido, productos)
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('sin_condicion')
    const productosSinCampo = [{ sku: 'SNTV007618', cantidad: 1 }]
    const r2 = detectarDiscrepanciasBasicas(pedido, productosSinCampo)
    expect(r2).toHaveLength(1)
    expect(r2[0].motivo).toBe('sin_condicion')
  })

  it('reconoce el formato legado condicion (string) de una línea de pedido', () => {
    const productos = [{ sku: 'SNTV007319-GRB', condicion: 'GRB', cantidad: 1 }]
    expect(detectarDiscrepanciasBasicas(pedido, productos)).toEqual([])
  })

  it('SKU inexistente en el pedido → discrepancia', () => {
    const productos = [{ sku: 'NO-EXISTE-GRB', condicion: 'GRB', cantidad: 1 }]
    expect(detectarDiscrepanciasBasicas(pedido, productos)).toHaveLength(1)
  })

  it('productos repetidos (mismo SKU+condición dos veces) se evalúan de forma independiente, sin duplicar de más ni fallar', () => {
    const productos = [
      { sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5 },
      { sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 3 },
    ]
    expect(detectarDiscrepanciasBasicas(pedido, productos)).toEqual([])

    const productosNoSolicitados = [
      { sku: 'X-GRB', condicion: 'GRB', cantidad: 1 },
      { sku: 'X-GRB', condicion: 'GRB', cantidad: 2 },
    ]
    expect(detectarDiscrepanciasBasicas(pedido, productosNoSolicitados)).toHaveLength(2)
  })

  it('no truena con pedido sin televisiones o productos vacíos', () => {
    expect(detectarDiscrepanciasBasicas({}, [])).toEqual([])
    expect(detectarDiscrepanciasBasicas({ televisiones: [] }, [{ sku: 'A-GRB', condicion: 'GRB', cantidad: 1 }])).toHaveLength(1)
  })
})

describe('vincularPallet / desvincularPallet — idempotencia y conflictos', () => {
  it('primera vinculación crea el link (201/vinculado)', async () => {
    const repo = crearRepoFake()
    const r = await vincularPallet(repo, {
      pedidoId: 'pedido-1',
      numeroPedidoSnapshot: '24072026',
      palletId: '389156-0015',
      usuario: usuarioCapturista(),
    })
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('vinculado')
    expect(r.body.link.vinculadoPor).toBe('user-1')
    expect(r.body.link.vinculadoPorNombre).toBe('Ana Capturista')
  })

  it('reenvío de la misma vinculación (mismo pedido) es idempotente, no duplica', async () => {
    const repo = crearRepoFake()
    await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    const r2 = await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    expect(r2.status).toBe(200)
    expect(r2.body.status).toBe('ya_vinculado')
    expect(repo._inspect.size).toBe(1)
  })

  it('intento de vincular el mismo pallet a otro pedido es rechazado (409, sin tocar el link existente)', async () => {
    const repo = crearRepoFake()
    await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    const r2 = await vincularPallet(repo, { pedidoId: 'pedido-2', palletId: 'P-1', usuario: usuarioCapturista() })
    expect(r2.status).toBe(409)
    expect(r2.body.status).toBe('conflicto')
    expect(repo._inspect.size).toBe(1)
    const activo = await repo.buscarActivoPorPalletId('P-1')
    expect(activo.pedidoId).toBe('pedido-1') // sigue vinculado al primero
  })

  it('desvinculación marca activo:false sin eliminar el documento', async () => {
    const repo = crearRepoFake()
    await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    const r = await desvincularPallet(repo, {
      pedidoId: 'pedido-1',
      palletId: 'P-1',
      motivo: 'Pallet dañado',
      usuario: usuarioCapturista(),
    })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('desvinculado')
    expect(repo._inspect.size).toBe(1) // no se borró
    const doc = [...repo._inspect.values()][0]
    expect(doc.activo).toBe(false)
    expect(doc.motivoDesvinculacion).toBe('Pallet dañado')
    expect(doc.desvinculadoPor).toBe('user-1')
  })

  it('segunda desvinculación es idempotente (no error)', async () => {
    const repo = crearRepoFake()
    await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    await desvincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    const r2 = await desvincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    expect(r2.status).toBe(200)
    expect(r2.body.status).toBe('ya_desvinculado')
  })

  it('desvincular un pallet nunca vinculado a ese pedido es idempotente (no error)', async () => {
    const repo = crearRepoFake()
    const r = await desvincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'NUNCA-VINCULADO', usuario: usuarioCapturista() })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('ya_desvinculado')
  })

  it('revinculación posterior (mismo pallet, incluso a otro pedido) funciona tras desvincular, y conserva el historial completo', async () => {
    const repo = crearRepoFake()
    await vincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    await desvincularPallet(repo, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })

    const r = await vincularPallet(repo, { pedidoId: 'pedido-2', palletId: 'P-1', usuario: usuarioCapturista() })
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('vinculado')

    // Historial: deben existir AMBOS documentos (el ciclo viejo desactivado
    // + el nuevo activo) — nunca se sobrescribe el primero.
    expect(repo._inspect.size).toBe(2)
    const docs = [...repo._inspect.values()]
    const viejo = docs.find((d) => d.pedidoId === 'pedido-1')
    const nuevo = docs.find((d) => d.pedidoId === 'pedido-2')
    expect(viejo.activo).toBe(false)
    expect(nuevo.activo).toBe(true)

    const activoAhora = await repo.buscarActivoPorPalletId('P-1')
    expect(activoAhora.pedidoId).toBe('pedido-2')
  })

  it('una carrera de inserción concurrente (E11000 real) se traduce en conflicto, no en error interno', async () => {
    const repo = crearRepoFake()
    // Fuerza el error de duplicado directamente en crear(), simulando dos
    // requests que llegan casi al mismo tiempo y ambos pasan la verificación
    // de buscarActivoPorPalletId antes de que el otro termine de insertar.
    const repoConCarrera = {
      ...repo,
      async crear() {
        const err = new Error('duplicate key')
        err.code = 11000
        throw err
      },
    }
    const r = await vincularPallet(repoConCarrera, { pedidoId: 'pedido-1', palletId: 'P-1', usuario: usuarioCapturista() })
    expect(r.status).toBe(409)
    expect(r.body.status).toBe('conflicto')
  })
})
