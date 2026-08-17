import { describe, expect, it } from 'vitest'
import { calcularTotales } from '@/lib/estado-pedido'

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

describe('calcularTotales — esquema legado (sin metasGrupo)', () => {
  it('usa cantidadTotal cuando está definida', () => {
    const pedido = {
      cantidadTotal: 50,
      televisiones: [tv({ cantidad: 10, sinLimite: false, cantidadSurtida: 5 })],
    }
    expect(calcularTotales(pedido)).toEqual({ totalRequerido: 50, totalSurtido: 5, progresoPct: 10, pendiente: 45 })
  })

  it('sin cantidadTotal, suma tv.cantidad', () => {
    const pedido = {
      televisiones: [
        tv({ cantidad: 10, sinLimite: false, cantidadSurtida: 4 }),
        tv({ cantidad: 20, sinLimite: false, cantidadSurtida: 20 }),
      ],
    }
    expect(calcularTotales(pedido)).toEqual({ totalRequerido: 30, totalSurtido: 24, progresoPct: 80, pendiente: 6 })
  })
})

// Pedido "LORENA" real: 6 grupos, metas 30/30/20/30/30/null = 140 definidas,
// SIN cantidadTotal manual (el caso real más común: el campo top-level
// "Cantidad total del pedido" queda vacío porque la meta ya vive en cada
// grupo, ver pedido-form.jsx). Antes de este fix, calcularTotales ignoraba
// metasGrupo por completo y sumaba tv.cantidad — que en este esquema
// siempre es 0 — dando totalRequerido=0 y progresoPct=0 pese a tener
// 48 piezas surtidas de 140 solicitadas (34%).
describe('calcularTotales — pedidos con metasGrupo (marca+pulgadas)', () => {
  const METAS_LORENA = {
    'LG-65': 30,
    'LG-75': 30,
    'SAMSUNG-65': 20,
    'SAMSUNG-70': 30,
    'SAMSUNG-75': 30,
    'SAMSUNG-85': null,
  }
  const pedidoLorena = {
    cantidadTotal: null,
    metasGrupo: METAS_LORENA,
    televisiones: [
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
    ],
  }

  it('calcula el total real desde metasGrupo, no desde tv.cantidad (que da 0)', () => {
    expect(calcularTotales(pedidoLorena)).toEqual({
      totalRequerido: 140,
      totalSurtido: 48,
      progresoPct: 34,
      pendiente: 92,
    })
  })

  it('metasGrupo vacío ({}) cae al esquema legado en vez de dar 0/0', () => {
    const pedido = {
      metasGrupo: {},
      cantidadTotal: 20,
      televisiones: [tv({ cantidad: 20, sinLimite: false, cantidadSurtida: 10 })],
    }
    expect(calcularTotales(pedido)).toEqual({ totalRequerido: 20, totalSurtido: 10, progresoPct: 50, pendiente: 10 })
  })

  it('con metasGrupo, cantidadTotal manual se ignora (metasGrupo manda)', () => {
    const pedido = { ...pedidoLorena, cantidadTotal: 9999 }
    expect(calcularTotales(pedido).totalRequerido).toBe(140)
  })
})
