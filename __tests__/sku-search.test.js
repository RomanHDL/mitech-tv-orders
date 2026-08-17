import { describe, expect, it } from 'vitest'
import { flattenGroupedProducts, groupProductsByBrandAndSize } from '@/lib/surtido-grupos'
import { normalizeSkuQuery, searchSkuMatches } from '@/lib/sku-search'

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

const METAS_LORENA = {
  'LG-65': 30,
  'LG-75': 30,
  'SAMSUNG-65': 20,
  'SAMSUNG-70': 30,
  'SAMSUNG-75': 30,
  'SAMSUNG-85': null,
}

const TELEVISIONES_LORENA = [
  tv({ marca: 'LG', pulgadas: 65, modelo: 'SNTV007271', cantidadSurtida: 3 }),
  tv({ marca: 'LG', pulgadas: 65, modelo: 'SNTV007305', cantidadSurtida: 3 }),
  tv({ marca: 'LG', pulgadas: 75, modelo: 'SNTV007263', cantidadSurtida: 2 }),
  tv({ marca: 'Samsung', pulgadas: 70, modelo: 'SNTV007705', cantidadSurtida: 0 }),
  tv({ marca: 'Samsung', pulgadas: 85, modelo: 'SNTV007264', cantidadSurtida: 0 }),
  tv({ marca: 'Samsung', pulgadas: 85, modelo: 'SNTV007716', cantidadSurtida: 0 }),
]

function flat() {
  return flattenGroupedProducts(groupProductsByBrandAndSize(TELEVISIONES_LORENA, METAS_LORENA))
}

describe('normalizeSkuQuery', () => {
  it('quita espacios y pasa a mayúsculas', () => {
    expect(normalizeSkuQuery('  sntv 007271 ')).toBe('SNTV007271')
  })
  it('cadena vacía o solo espacios da vacío', () => {
    expect(normalizeSkuQuery('   ')).toBe('')
    expect(normalizeSkuQuery('')).toBe('')
    expect(normalizeSkuQuery(undefined)).toBe('')
  })
})

describe('searchSkuMatches', () => {
  it('SKU completo exacto (mayúsculas) encuentra ese único SKU', () => {
    const r = searchSkuMatches(flat(), 'SNTV007271')
    expect(r).toHaveLength(1)
    expect(r[0].product.modelo).toBe('SNTV007271')
  })

  it('SKU completo en minúsculas también lo encuentra', () => {
    const r = searchSkuMatches(flat(), 'sntv007271')
    expect(r).toHaveLength(1)
    expect(r[0].product.modelo).toBe('SNTV007271')
  })

  it('últimos 4 dígitos únicos encuentran el SKU correcto', () => {
    const r = searchSkuMatches(flat(), '7271')
    expect(r).toHaveLength(1)
    expect(r[0].product.modelo).toBe('SNTV007271')
  })

  it('últimos 4 dígitos de otro SKU distinto', () => {
    const r = searchSkuMatches(flat(), '7305')
    expect(r).toHaveLength(1)
    expect(r[0].product.modelo).toBe('SNTV007305')
  })

  it('código inexistente no encuentra nada', () => {
    expect(searchSkuMatches(flat(), '9999')).toHaveLength(0)
  })

  it('sufijo compartido por dos SKU devuelve ambos (nunca elige uno arbitrariamente)', () => {
    const productos = [
      ...TELEVISIONES_LORENA,
      tv({ marca: 'ABCD', pulgadas: 75, modelo: 'ABCD007271', cantidadSurtida: 0 }),
    ]
    const metas = { ...METAS_LORENA, 'ABCD-75': 10 }
    const flatConDuplicado = flattenGroupedProducts(groupProductsByBrandAndSize(productos, metas))
    const r = searchSkuMatches(flatConDuplicado, '7271')
    expect(r).toHaveLength(2)
    expect(r.map((m) => m.product.modelo).sort()).toEqual(['ABCD007271', 'SNTV007271'])
  })

  it('búsqueda vacía no devuelve resultados (ni todos los productos)', () => {
    expect(searchSkuMatches(flat(), '')).toHaveLength(0)
    expect(searchSkuMatches(flat(), '   ')).toHaveLength(0)
  })

  it('coincidencia exacta nunca se diluye con sufijos casuales de otros SKU', () => {
    // Si el propio SKU exacto también sería sufijo de sí mismo, la familia
    // exacta gana y no se agregan sufijos parciales de otros SKU distintos.
    const r = searchSkuMatches(flat(), 'SNTV007705')
    expect(r).toHaveLength(1)
    expect(r[0].product.modelo).toBe('SNTV007705')
  })

  it('grupo con meta compartida — el match conserva el resumen del grupo', () => {
    const r = searchSkuMatches(flat(), '7271')
    expect(r[0].group.requested).toBe(30)
    expect(r[0].group.products.length).toBeGreaterThan(1)
  })

  it('grupo de un solo SKU expone su meta individual', () => {
    const r = searchSkuMatches(flat(), '7705')
    expect(r[0].group.summary.individualTarget).toBe(30)
  })

  it('grupo por definir (Samsung 85") no inventa una meta', () => {
    const r = searchSkuMatches(flat(), '7264')
    expect(r[0].group.requested).toBeNull()
    expect(r[0].group.summary.individualTarget).toBeNull()
  })
})
