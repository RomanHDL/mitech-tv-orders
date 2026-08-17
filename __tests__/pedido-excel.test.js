import { describe, expect, it } from 'vitest'
import { construirFilasPedido } from '@/lib/pedido-excel'
import esMX from '../public/locales/es-MX/common.json'

function buscarClave(dict, clave) {
  return clave.split('.').reduce((acc, parte) => (acc && acc[parte] !== undefined ? acc[parte] : undefined), dict)
}

// Mismo "t" simplificado que usa lib/i18n-server.js — suficiente para
// probar el contenido real de las filas sin depender de react-i18next.
function t(clave, params) {
  let claveFinal = clave
  if (params && typeof params.count === 'number') {
    claveFinal = `${clave}_${params.count === 1 ? 'one' : 'other'}`
    if (buscarClave(esMX, claveFinal) === undefined) claveFinal = clave
  }
  let str = buscarClave(esMX, claveFinal)
  if (str === undefined) return clave
  if (params) {
    for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{{${k}}}`, v)
  }
  return str
}

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

const PEDIDO_LORENA = {
  pedidoNombre: 'LORENA',
  numeroPedido: '24072026',
  condiciones: ['GRA'],
  metasGrupo: METAS_LORENA,
  fecha: '2026-07-24T12:00:00',
  fechaLimite: '2026-08-20',
  creadoPorNombre: 'Roman Herrera',
  estadoOperativo: null,
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

describe('construirFilasPedido — LORENA', () => {
  const { filas, merges, colWidths, nombreArchivo } = construirFilasPedido(PEDIDO_LORENA, t, 'es-MX')

  it('título con el nombre del pedido en mayúsculas', () => {
    expect(filas[0]).toEqual(['LORENA'])
  })

  it('nombre de archivo incluye número y nombre, sin caracteres inválidos', () => {
    expect(nombreArchivo).toBe('pedido-24072026-LORENA.xlsx')
  })

  it('resumen general usa los totales agrupados correctos (no la meta legacy)', () => {
    const idxEncabezado = filas.findIndex((f) => f[0] === t('imprimir.totalSku'))
    // Fila de valores del resumen: [totalSku, totalSolicitado, totalSurtido, totalPendiente, pct]
    const fila = filas[idxEncabezado + 1]
    expect(fila[0]).toBe(16) // total SKU
    expect(fila[1]).toBe(140) // total solicitado (suma de metas definidas)
    expect(fila[2]).toBe(48) // total surtido real
    expect(fila[3]).toBe(92) // total pendiente
    expect(fila[4]).toBe('34%')
  })

  it('incluye encabezado de marca LG y SAMSUNG', () => {
    const textos = filas.map((f) => f[0])
    expect(textos.some((x) => String(x).startsWith('LG —'))).toBe(true)
    expect(textos.some((x) => String(x).startsWith('SAMSUNG —'))).toBe(true)
  })

  it('fila de grupo LG 65" muestra meta/surtido/pendiente del GRUPO', () => {
    const fila = filas.find((f) => f[1] === 'LG 65"')
    expect(fila[3]).toBe(30) // solicitado grupo
    expect(fila[4]).toBe(6) // surtido grupo
    expect(fila[5]).toBe(24) // pendiente grupo
  })

  it('SKU dentro de un grupo compartido no repite la meta del grupo (nunca "30")', () => {
    const fila = filas.find((f) => f[1] === 'SNTV007271')
    expect(fila[3]).toBe(t('imprimir.metaCompartida'))
    expect(fila[3]).not.toBe(30)
    expect(fila[4]).toBe(3) // surtido propio del SKU
  })

  it('Samsung 70" (único SKU con meta) muestra su meta individual', () => {
    const fila = filas.find((f) => f[1] === 'SNTV007705')
    expect(fila[3]).toBe(30)
    expect(fila[5]).toBe(30) // pendiente individual
  })

  it('Samsung 85" (grupo por definir) nunca inventa una meta', () => {
    const filaGrupo = filas.find((f) => f[1] === 'Samsung 85"')
    expect(filaGrupo[3]).toBe(t('surtir.grupo.porDefinir'))
    const filaSku = filas.find((f) => f[1] === 'SNTV007264')
    expect(filaSku[3]).toBe(t('surtir.grupo.porDefinir'))
  })

  it('todas las filas tienen como máximo 7 columnas', () => {
    filas.forEach((f) => expect(f.length).toBeLessThanOrEqual(7))
  })

  it('los merges apuntan a filas reales dentro del rango generado', () => {
    merges.forEach((m) => {
      expect(m.s.r).toBeGreaterThanOrEqual(0)
      expect(m.s.r).toBeLessThan(filas.length)
      expect(m.e.c).toBe(6)
    })
  })

  it('define 7 anchos de columna', () => {
    expect(colWidths).toHaveLength(7)
  })
})
