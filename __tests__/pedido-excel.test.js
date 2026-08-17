import { describe, expect, it } from 'vitest'
import { construirReportePedido } from '@/lib/pedido-excel'
import esMX from '../public/locales/es-MX/common.json'

function buscarClave(dict, clave) {
  return clave.split('.').reduce((acc, parte) => (acc && acc[parte] !== undefined ? acc[parte] : undefined), dict)
}

// Mismo "t" simplificado que usa lib/i18n-server.js — suficiente para
// probar el contenido real del reporte sin depender de react-i18next.
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

function grupo(reporte, marca, texto) {
  return reporte.marcas.find((m) => m.etiqueta === marca).grupos.find((g) => g.etiqueta.startsWith(texto))
}

describe('construirReportePedido — LORENA', () => {
  const reporte = construirReportePedido(PEDIDO_LORENA, t)

  it('nombre de archivo incluye número y nombre, sin caracteres inválidos', () => {
    expect(reporte.nombreArchivo).toBe('pedido-24072026-LORENA.xlsx')
  })

  it('encabezado dinámico: nombre · número de pedido', () => {
    expect(reporte.encabezado.subtitulo).toContain('LORENA')
    expect(reporte.encabezado.subtitulo).toContain('24072026')
  })

  it('resumen general usa los totales agrupados correctos (no la meta legacy)', () => {
    expect(reporte.resumen.totalSku).toBe(16)
    expect(reporte.resumen.totalSolicitado).toBe(140)
    expect(reporte.resumen.totalSurtido).toBe(48)
    expect(reporte.resumen.totalPendiente).toBe(92)
    expect(reporte.resumen.progresoPct).toBe(34)
    expect(reporte.resumen.textoProgreso).toContain('34%')
  })

  it('las marcas salen dinámicamente en el orden de aparición (nunca hardcodeadas)', () => {
    const etiquetas = reporte.marcas.map((m) => m.etiqueta)
    expect(etiquetas).toEqual(['LG', 'SAMSUNG'])
  })

  it('resumen de marca incluye SKU/solicitado/surtido/pendiente reales', () => {
    const lg = reporte.marcas.find((m) => m.etiqueta === 'LG')
    expect(lg.resumenTexto).toContain('6 SKU')
    expect(lg.resumenTexto).toContain('60') // solicitado LG: 30+30
    expect(lg.resumenTexto).toContain('9') // surtido LG: 6 (LG65) + 3 (LG75)
  })

  it('grupo LG 65" muestra solicitado/surtido/pendiente del GRUPO, no de un SKU', () => {
    const g = grupo(reporte, 'LG', 'LG 65"')
    expect(g.solicitado).toEqual({ tipo: 'numero', valor: 30 })
    expect(g.surtido).toBe(6)
    expect(g.pendiente).toEqual({ tipo: 'numero', valor: 24 })
    expect(g.estado.categoria).toBe('en-proceso')
  })

  it('SKU dentro de un grupo compartido no repite la meta del grupo (nunca "30")', () => {
    const g = grupo(reporte, 'LG', 'LG 65"')
    const sku = g.skus.find((s) => s.modelo === 'SNTV007271')
    expect(sku.solicitado.tipo).toBe('metaCompartida')
    expect(sku.solicitado.valor).not.toBe(30)
    expect(sku.surtido).toBe(3)
    expect(sku.pendiente).toEqual({ tipo: 'vacio' })
  })

  it('Samsung 70" (único SKU con meta) muestra su meta individual y su pendiente real', () => {
    const g = grupo(reporte, 'SAMSUNG', 'Samsung 70"')
    expect(g.solicitado).toEqual({ tipo: 'numero', valor: 30 })
    const sku = g.skus[0]
    expect(sku.modelo).toBe('SNTV007705')
    expect(sku.solicitado).toEqual({ tipo: 'numero', valor: 30 })
    expect(sku.pendiente).toEqual({ tipo: 'numero', valor: 30 })
    expect(sku.estado.categoria).toBe('pendiente')
  })

  it('Samsung 85" (grupo por definir) nunca inventa una meta, ni en el grupo ni en sus SKU', () => {
    const g = grupo(reporte, 'SAMSUNG', 'Samsung 85"')
    expect(g.solicitado.tipo).toBe('porDefinir')
    expect(g.pendiente).toEqual({ tipo: 'vacio' })
    expect(g.estado.categoria).toBe('por-definir')
    g.skus.forEach((sku) => {
      expect(sku.solicitado.tipo).toBe('porDefinir')
      expect(sku.pendiente).toEqual({ tipo: 'vacio' })
    })
  })

  it('respeta el orden original de los SKU dentro del grupo (nunca alfabético)', () => {
    const g = grupo(reporte, 'LG', 'LG 75"')
    expect(g.skus.map((s) => s.modelo)).toEqual(['SNTV007263', 'SNTV007447', 'SNTV005313', 'SNTV007744'])
  })

  it('conserva todas las condiciones, incluidas múltiples por SKU', () => {
    const g = grupo(reporte, 'SAMSUNG', 'Samsung 75"')
    const sku = g.skus.find((s) => s.modelo === 'SNTV007618')
    expect(sku.condiciones).toEqual(['GRA', 'GRB', 'GRC'])
  })

  it('grupo completo (Samsung 65") cae en la categoría "completo"', () => {
    const g = grupo(reporte, 'SAMSUNG', 'Samsung 65"')
    expect(g.pendiente).toEqual({ tipo: 'numero', valor: 0 })
    expect(g.estado.categoria).toBe('completo')
  })

  it('incluye leyenda y encabezados de columna', () => {
    expect(reporte.leyenda).toBeTruthy()
    expect(reporte.columnas.sku).toBeTruthy()
    expect(reporte.columnas.solicitado).toBeTruthy()
  })

  it('nunca pierde ningún SKU (16 en total)', () => {
    const total = reporte.marcas.flatMap((m) => m.grupos).flatMap((g) => g.skus).length
    expect(total).toBe(16)
  })
})
