import { describe, expect, it } from 'vitest'
import {
  GROUP_STATUS,
  calculateBrandSummary,
  calculateGroupSummary,
  calculateOrderSummary,
  createGroupKey,
  getGroupStatus,
  getIndividualSkuTarget,
  groupProductsByBrandAndSize,
  isRequestedQuantityDefined,
  normalizeBrand,
  normalizeSize,
  resolveGroupRequested,
} from '@/lib/surtido-grupos'

function tv(overrides = {}) {
  return {
    marca: 'LG',
    pulgadas: 65,
    modelo: 'SNTV000000',
    condiciones: ['GRA'],
    cantidad: 0,
    unidad: 'pieza',
    sinLimite: true,
    cantidadSurtida: 0,
    ...overrides,
  }
}

// Pedido "Lorena" real: 6 grupos, metas 30/30/20/30/30/null = 140 definidas.
const METAS_LORENA = {
  'LG-65': 30,
  'LG-75': 30,
  'SAMSUNG-65': 20,
  'SAMSUNG-70': 30,
  'SAMSUNG-75': 30,
  'SAMSUNG-85': null,
}

function pedidoLorena(overridesPorSku = {}) {
  const base = [
    tv({ marca: 'LG', pulgadas: 65, modelo: 'SNTV007271', cantidadSurtida: 3 }),
    tv({ marca: 'LG', pulgadas: 65, modelo: 'SNTV007305', cantidadSurtida: 3 }),
    tv({ marca: 'LG', pulgadas: 75, modelo: 'SNTV007263', cantidadSurtida: 2 }),
    tv({ marca: 'LG', pulgadas: 75, modelo: 'SNTV007447', cantidadSurtida: 0 }),
    tv({ marca: 'LG', pulgadas: 75, modelo: 'SNTV005313', cantidadSurtida: 0 }),
    tv({ marca: 'LG', pulgadas: 75, modelo: 'SNTV007744', cantidadSurtida: 1 }),
    tv({ marca: 'Samsung', pulgadas: 65, modelo: 'SNTV007585', cantidadSurtida: 8 }),
    tv({ marca: 'Samsung', pulgadas: 65, modelo: 'SNTV006971', cantidadSurtida: 0 }),
    tv({ marca: 'Samsung', pulgadas: 65, modelo: 'SNTV007267', cantidadSurtida: 8 }),
    tv({ marca: 'Samsung', pulgadas: 65, modelo: 'SNTV007615', cantidadSurtida: 4 }),
    tv({ marca: 'Samsung', pulgadas: 70, modelo: 'SNTV007705', cantidadSurtida: 0 }),
    tv({ marca: 'Samsung', pulgadas: 75, modelo: 'SNTV007319', cantidadSurtida: 3 }),
    tv({ marca: 'Samsung', pulgadas: 75, modelo: 'SNTV007704', cantidadSurtida: 0 }),
    tv({ marca: 'Samsung', pulgadas: 75, modelo: 'SNTV007618', condiciones: ['GRA', 'GRB', 'GRC'], cantidadSurtida: 16 }),
    tv({ marca: 'Samsung', pulgadas: 85, modelo: 'SNTV007264', cantidadSurtida: 0 }),
    tv({ marca: 'Samsung', pulgadas: 85, modelo: 'SNTV007716', cantidadSurtida: 0 }),
  ]
  return base.map((t, i) => (overridesPorSku[i] ? { ...t, ...overridesPorSku[i] } : t))
}

function grupo(brand, size, brands) {
  return brands.find((b) => b.key === normalizeBrand(brand)).sizes.find((g) => g.size === size)
}

describe('normalizeBrand / normalizeSize / createGroupKey', () => {
  it('normaliza LG, lg y Lg a la misma clave', () => {
    expect(normalizeBrand('LG')).toBe(normalizeBrand('lg'))
    expect(normalizeBrand('Lg')).toBe('LG')
  })
  it('normaliza Samsung, SAMSUNG y samsung a la misma clave', () => {
    expect(normalizeBrand('Samsung')).toBe(normalizeBrand('SAMSUNG'))
    expect(normalizeBrand('samsung')).toBe('SAMSUNG')
  })
  it('createGroupKey combina marca normalizada y pulgadas', () => {
    expect(createGroupKey('Samsung', 70)).toBe('SAMSUNG-70')
  })
})

describe('isRequestedQuantityDefined — distingue 0/null/undefined/""', () => {
  it('0 está definido (meta real de cero)', () => expect(isRequestedQuantityDefined(0)).toBe(true))
  it('null no está definido', () => expect(isRequestedQuantityDefined(null)).toBe(false))
  it('undefined no está definido', () => expect(isRequestedQuantityDefined(undefined)).toBe(false))
  it('"" no está definido', () => expect(isRequestedQuantityDefined('')).toBe(false))
})

describe('1-2. LG 65" — meta conjunta, sin repartición forzada', () => {
  it('1. SKU1=28, SKU2=2 → total 30, pendiente 0, COMPLETO', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 0: { cantidadSurtida: 28 }, 1: { cantidadSurtida: 2 } }),
      METAS_LORENA,
    )
    const g = grupo('LG', 65, brands)
    expect(g.summary.supplied).toBe(30)
    expect(g.summary.pending).toBe(0)
    expect(g.summary.status).toBe(GROUP_STATUS.COMPLETE)
  })

  it('2. SKU1=30, SKU2=0 → total 30, COMPLETO, sin obligar 15/15', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 0: { cantidadSurtida: 30 }, 1: { cantidadSurtida: 0 } }),
      METAS_LORENA,
    )
    const g = grupo('LG', 65, brands)
    expect(g.products[0].cantidadSurtida).toBe(30)
    expect(g.products[1].cantidadSurtida).toBe(0)
    expect(g.summary.supplied).toBe(30)
    expect(g.summary.status).toBe(GROUP_STATUS.COMPLETE)
  })
})

describe('3-4-6. Grupos multi-SKU comparan la SUMA contra la meta conjunta', () => {
  it('3. LG 75" — 4 SKU, meta 30, suma real de los 4', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('LG', 75, brands)
    expect(g.products).toHaveLength(4)
    expect(g.requested).toBe(30)
    expect(g.summary.supplied).toBe(2 + 0 + 0 + 1)
  })

  it('4. Samsung 65" — 4 SKU, meta 20, suma real de los 4', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('Samsung', 65, brands)
    expect(g.products).toHaveLength(4)
    expect(g.requested).toBe(20)
    expect(g.summary.supplied).toBe(8 + 0 + 8 + 4)
  })

  it('6. Samsung 75" — 3 SKU, meta 30, suma real de los 3', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('Samsung', 75, brands)
    expect(g.products).toHaveLength(3)
    expect(g.requested).toBe(30)
    expect(g.summary.supplied).toBe(3 + 0 + 16)
  })
})

describe('5. Samsung 70" — único SKU, meta individual = meta del grupo', () => {
  it('meta del grupo y del SKU es 30 (regla general, no hardcodeada)', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('Samsung', 70, brands)
    expect(g.products).toHaveLength(1)
    expect(g.requested).toBe(30)
    expect(getIndividualSkuTarget(g)).toBe(30)
  })

  it('con surtido 18, pendiente = 12, EN_PROCESO', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 10: { cantidadSurtida: 18 } }),
      METAS_LORENA,
    )
    const g = grupo('Samsung', 70, brands)
    expect(g.summary.supplied).toBe(18)
    expect(g.summary.pending).toBe(12)
    expect(g.summary.status).toBe(GROUP_STATUS.IN_PROGRESS)
  })

  it('con surtido 30, COMPLETO', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 10: { cantidadSurtida: 30 } }),
      METAS_LORENA,
    )
    const g = grupo('Samsung', 70, brands)
    expect(g.summary.status).toBe(GROUP_STATUS.COMPLETE)
  })

  it('getIndividualSkuTarget regresa null si hay más de un SKU, aunque la meta esté definida', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('LG', 65, brands)
    expect(getIndividualSkuTarget(g)).toBeNull()
  })
})

describe('7. Samsung 85" — meta por definir', () => {
  it('requested null, pending null, estado POR_DEFINIR, nunca "completo" en cero', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('Samsung', 85, brands)
    expect(g.requested).toBeNull()
    expect(g.summary.pending).toBeNull()
    expect(g.summary.status).toBe(GROUP_STATUS.UNDEFINED)
    expect(g.summary.status).not.toBe(GROUP_STATUS.COMPLETE)
  })

  it('si se surten piezas sin meta, se contabilizan como surtidas del grupo pero sigue POR_DEFINIR', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 14: { cantidadSurtida: 5 } }),
      METAS_LORENA,
    )
    const g = grupo('Samsung', 85, brands)
    expect(g.summary.supplied).toBe(5)
    expect(g.summary.status).toBe(GROUP_STATUS.UNDEFINED)
  })

  it('sin metasGrupo definido y con algún SKU sin límite, también cae a por definir', () => {
    expect(resolveGroupRequested('X-99', [tv({ sinLimite: true })], undefined)).toBeNull()
  })
})

describe('8. Grupo excedido', () => {
  it('meta 30, surtido 32 → pendiente 0, excedente 2, EXCEDIDO', () => {
    const summary = calculateGroupSummary({
      products: [tv({ cantidadSurtida: 32 })],
      requested: 30,
    })
    expect(summary.pending).toBe(0)
    expect(summary.excess).toBe(2)
    expect(summary.status).toBe(GROUP_STATUS.EXCEEDED)
  })

  it('getGroupStatus prioriza EXCEDIDO sobre COMPLETO cuando supplied > requested', () => {
    expect(getGroupStatus(30, 32)).toBe(GROUP_STATUS.EXCEEDED)
    expect(getGroupStatus(30, 30)).toBe(GROUP_STATUS.COMPLETE)
  })
})

describe('9. Orden de presentación', () => {
  it('mantiene el orden de las marcas según su primera aparición', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    expect(brands.map((b) => b.key)).toEqual(['LG', 'SAMSUNG'])
  })

  it('ordena las pulgadas numéricamente de menor a mayor dentro de cada marca', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    expect(brands.find((b) => b.key === 'SAMSUNG').sizes.map((g) => g.size)).toEqual([65, 70, 75, 85])
  })

  it('conserva el orden original de inserción de los SKU dentro de cada grupo (sin alfabético/cantidad/SKU)', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const g = grupo('Samsung', 75, brands)
    expect(g.products.map((p) => p.modelo)).toEqual(['SNTV007319', 'SNTV007704', 'SNTV007618'])
  })
})

describe('10. Identificadores estables (_idx real, no posición renderizada)', () => {
  it('cada producto conserva su índice real en el arreglo original', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    // SNTV007618 está en la posición 13 del arreglo original (0-indexed) aunque
    // en el grupo "Samsung 75" renderizado sea el tercer elemento.
    const g = grupo('Samsung', 75, brands)
    const item = g.products.find((p) => p.modelo === 'SNTV007618')
    expect(item._idx).toBe(13)
  })

  it('el reordenamiento visual (pulgadas ascendente) no cambia el _idx de cada producto', () => {
    const original = pedidoLorena()
    const brands = groupProductsByBrandAndSize(original, METAS_LORENA)
    brands.forEach((b) => b.sizes.forEach((g) => g.products.forEach((p) => {
      expect(original[p._idx].modelo).toBe(p.modelo)
    })))
  })
})

describe('13. Total del pedido', () => {
  it('la suma de metas definidas es exactamente 140', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const summary = calculateOrderSummary(brands)
    expect(summary.totalRequestedDefined).toBe(140)
  })

  it('Samsung 85" no se agrega al solicitado mientras esté por definir', () => {
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 14: { cantidadSurtida: 5 } }),
      METAS_LORENA,
    )
    const summary = calculateOrderSummary(brands)
    expect(summary.totalRequestedDefined).toBe(140)
    expect(summary.totalSuppliedUndefined).toBe(5)
    expect(summary.undefinedCount).toBe(1)
  })

  it('el pendiente general suma solo los grupos con meta definida (nunca 140 - suma absoluta)', () => {
    // Si Samsung 85" tuviera piezas surtidas, restarlas del pendiente general
    // sería incorrecto porque esas piezas no cuentan contra ninguna meta real.
    const brands = groupProductsByBrandAndSize(
      pedidoLorena({ 14: { cantidadSurtida: 100 } }),
      METAS_LORENA,
    )
    const summary = calculateOrderSummary(brands)
    const brandsSinExtra = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const summarySinExtra = calculateOrderSummary(brandsSinExtra)
    expect(summary.totalPending).toBe(summarySinExtra.totalPending)
  })
})

describe('calculateBrandSummary', () => {
  it('LG: 6 SKU, 60 solicitadas (30+30), sin grupos por definir', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const lg = calculateBrandSummary(brands.find((b) => b.key === 'LG'))
    expect(lg.skuCount).toBe(6)
    expect(lg.requestedDefinedTotal).toBe(60)
    expect(lg.undefinedGroupsCount).toBe(0)
  })

  it('Samsung: 10 SKU, 80 solicitadas (20+30+30), 1 grupo por definir', () => {
    const brands = groupProductsByBrandAndSize(pedidoLorena(), METAS_LORENA)
    const samsung = calculateBrandSummary(brands.find((b) => b.key === 'SAMSUNG'))
    expect(samsung.skuCount).toBe(10)
    expect(samsung.requestedDefinedTotal).toBe(80)
    expect(samsung.undefinedGroupsCount).toBe(1)
  })
})

describe('SKU agregado de último momento se coloca en el grupo correcto', () => {
  it('un TV nuevo con marca/pulgadas existentes se agrega a ese grupo sin tocar su meta', () => {
    const conExtra = [
      ...pedidoLorena(),
      tv({ marca: 'LG', pulgadas: 65, modelo: 'SNTVEXTRA1', cantidadSurtida: 1, esUltimoMomento: true }),
    ]
    const brands = groupProductsByBrandAndSize(conExtra, METAS_LORENA)
    const g = grupo('LG', 65, brands)
    expect(g.products).toHaveLength(3)
    expect(g.requested).toBe(30) // la meta no cambia por agregar un SKU
    expect(g.products[2].modelo).toBe('SNTVEXTRA1')
  })

  it('un TV nuevo con marca/pulgadas inexistentes crea su propia sección "por definir"', () => {
    const conExtra = [...pedidoLorena(), tv({ marca: 'Sony', pulgadas: 50, modelo: 'SNTVNEW1', cantidadSurtida: 2 })]
    const brands = groupProductsByBrandAndSize(conExtra, METAS_LORENA)
    const sony = brands.find((b) => b.key === 'SONY')
    expect(sony).toBeDefined()
    expect(sony.sizes[0].requested).toBeNull()
    expect(sony.sizes[0].summary.status).toBe(GROUP_STATUS.UNDEFINED)
  })
})
