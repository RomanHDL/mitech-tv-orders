import { describe, expect, it } from 'vitest'
import { calcularProgresoPedido } from '@/lib/integration-pedido-progreso'

function pallet(overrides = {}) {
  return {
    palletId: 'P-1',
    activo: true,
    productos: [],
    ...overrides,
  }
}

function link(overrides = {}) {
  return {
    pedidoId: 'pedido-1',
    palletId: 'P-1',
    activo: true,
    ...overrides,
  }
}

function vinculo(palletOverrides = {}, linkOverrides = {}) {
  const p = pallet(palletOverrides)
  return { link: link({ palletId: p.palletId, ...linkOverrides }), pallet: p }
}

// Pedido base del caso de aceptación: 24072026, 140 solicitadas, 24 manual.
function pedidoAceptacion(overrides = {}) {
  return {
    numeroPedido: '24072026',
    cantidadTotal: 140,
    televisiones: [
      { modelo: 'SNTV007618', condiciones: ['GRB'], cantidad: 80, cantidadSurtida: 24 },
      { modelo: 'SNTV007319', condiciones: ['GRC'], cantidad: 60, cantidadSurtida: 0 },
    ],
    ...overrides,
  }
}

describe('calcularProgresoPedido — casos base', () => {
  it('1. Pedido sin pallets vinculados', () => {
    const r = calcularProgresoPedido(pedidoAceptacion(), [])
    expect(r.resumen).toMatchObject({
      cantidadSolicitada: 140,
      cantidadSurtidaManual: 24,
      cantidadSincronizada: 0,
      cantidadSincronizadaValida: 0,
      cantidadConDiscrepancia: 0,
      surtidoEfectivo: 24, // max(manual, 0) por línea, sumado
      cantidadPendiente: 116,
      palletsVinculados: 0,
    })
  })

  it('2. Un pallet con 12 piezas válidas', () => {
    const vinculos = [
      vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] }),
    ]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(12)
    expect(r.resumen.cantidadConDiscrepancia).toBe(0)
    expect(r.resumen.palletsVinculados).toBe(1)
  })

  it('3. Dos pallets con 12 piezas cada uno — CASO DE ACEPTACIÓN', () => {
    const vinculos = [
      vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] }),
      vinculo({ palletId: 'B', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] }),
    ]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen).toMatchObject({
      cantidadSolicitada: 140,
      cantidadSincronizada: 24,
      cantidadSincronizadaValida: 24,
      cantidadConDiscrepancia: 0,
      surtidoEfectivo: 24,
      cantidadPendiente: 116,
      porcentajeEfectivo: 17.14,
      palletsVinculados: 2,
    })
    expect(r.discrepancias).toEqual([])
    expect(r.advertencias).toEqual([])
  })

  it('4. Duplicado lógico (mismo palletId dos veces en la entrada) no duplica piezas', () => {
    const p = pallet({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] })
    const l = link({ palletId: 'A' })
    const vinculos = [{ link: l, pallet: p }, { link: l, pallet: p }] // el mismo par repetido
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(12) // no 24
    expect(r.resumen.palletsVinculados).toBe(1)
  })

  it('5. Pallet desactivado no cuenta y genera advertencia', () => {
    const vinculos = [vinculo({ palletId: 'A', activo: false, productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(0)
    expect(r.resumen.palletsVinculados).toBe(0)
    expect(r.advertencias).toContainEqual({ tipo: 'pallet_inactivo', palletId: 'A' })
  })

  it('6. Link desactivado no cuenta y genera advertencia', () => {
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 12 }] }, { activo: false })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(0)
    expect(r.resumen.palletsVinculados).toBe(0)
    expect(r.advertencias).toContainEqual({ tipo: 'link_inactivo', palletId: 'A' })
  })

  it('7. SKU incorrecto (no solicitado) → discrepancia', () => {
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'SKU-DESCONOCIDO-GRB', condicion: 'GRB', cantidad: 5 }] })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(0)
    expect(r.discrepancias).toContainEqual({ sku: 'SKU-DESCONOCIDO-GRB', condicion: 'GRB', cantidad: 5, motivo: 'no_solicitado' })
  })

  it('8. Condición incorrecta (SKU válido, condición no aceptada) → discrepancia', () => {
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRD', condicion: 'GRD', cantidad: 5 }] })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(0)
    expect(r.discrepancias).toHaveLength(1)
    expect(r.discrepancias[0].motivo).toBe('no_solicitado')
  })

  it('9. SKU con sufijo de condición coincide con el modelo sin sufijo del pedido', () => {
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'sntv007618-grb', condicion: '  grb  ', cantidad: 7 }] })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(7)
    expect(r.discrepancias).toEqual([])
  })

  it('10. Exceso sobre la cantidad solicitada de la línea → discrepancia cantidad_excedente', () => {
    const pedido = {
      televisiones: [{ modelo: 'SNTV007618', condiciones: ['GRB'], cantidad: 10, cantidadSurtida: 0 }],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 15 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(10) // tope a lo solicitado
    expect(r.resumen.cantidadSincronizada).toBe(15) // bruto sin tope
    // El sku se reporta tal como llegó del pallet (con el sufijo original),
    // no la versión normalizada — es lo más legible para quien lo revisa.
    expect(r.discrepancias).toContainEqual({ sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5, motivo: 'cantidad_excedente' })
  })

  it('11. Varias líneas con el mismo SKU se reparten en orden sin duplicar piezas', () => {
    const pedido = {
      televisiones: [
        { modelo: 'X', condiciones: ['GRB'], cantidad: 5, cantidadSurtida: 0 },
        { modelo: 'X', condiciones: ['GRB'], cantidad: 5, cantidadSurtida: 0 },
      ],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 8 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].cantidadSincronizadaValida).toBe(5) // la primera línea se llena primero
    expect(r.lineas[1].cantidadSincronizadaValida).toBe(3) // la segunda recibe el resto
    expect(r.resumen.cantidadSincronizadaValida).toBe(8)
    expect(r.discrepancias).toEqual([]) // nada sobra, nada se cuenta dos veces
  })

  it('12. Varias condiciones permitidas en una línea aceptan cualquiera de ellas', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRA', 'GRB'], cantidad: 10, cantidadSurtida: 0 }],
    }
    const vinculos = [
      vinculo({ palletId: 'A', productos: [{ sku: 'X-GRA', condicion: 'GRA', cantidad: 3 }] }),
      vinculo({ palletId: 'B', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 4 }] }),
    ]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].cantidadSincronizadaValida).toBe(7) // 3 + 4, misma línea
    expect(r.discrepancias).toEqual([])
  })

  it('13. Línea de último momento (esUltimoMomento) se trata como una línea normal', () => {
    const pedido = {
      televisiones: [
        { modelo: 'X', condiciones: ['GRB'], cantidad: 5, cantidadSurtida: 5, esUltimoMomento: true, agregadoPorNombre: 'Ana' },
      ],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 5 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].cantidadSincronizadaValida).toBe(5)
    expect(r.lineas[0].surtidoEfectivo).toBe(5) // max(5 manual, 5 sync)
  })

  it('14. Surtido manual mayor que sincronizado → prevalece el manual (sin sumar)', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRB'], cantidad: 100, cantidadSurtida: 50 }],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 10 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].surtidoEfectivo).toBe(50) // no 60
  })

  it('15. Sincronizado mayor que manual → prevalece el sincronizado (sin sumar)', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRB'], cantidad: 100, cantidadSurtida: 5 }],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 30 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].surtidoEfectivo).toBe(30) // no 35
  })

  // Decisión 1 (definitiva): surtidoEfectivoTotal es la SUMA de max(manual,
  // sincronizadaValida) POR LÍNEA — nunca max(totalManual, totalSincronizado)
  // a nivel global. Con manual y sincronizado en líneas DISTINTAS, el máximo
  // global daría 10 (perdiendo la mitad del progreso real); la suma de
  // máximos por línea da 20, que es el resultado correcto y aprobado.
  it('Decisión 1: manual en una línea + sincronizado en otra línea → el total es la SUMA de los máximos por línea (20, no 10)', () => {
    const pedido = {
      televisiones: [
        { modelo: 'A', condiciones: ['GRB'], cantidad: 10, cantidadSurtida: 10 }, // línea A: manual 10, sync 0
        { modelo: 'B', condiciones: ['GRC'], cantidad: 10, cantidadSurtida: 0 },  // línea B: manual 0, sync 10
      ],
    }
    const vinculos = [vinculo({ palletId: 'P', productos: [{ sku: 'B-GRC', condicion: 'GRC', cantidad: 10 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)

    expect(r.lineas[0]).toMatchObject({ cantidadSurtidaManual: 10, cantidadSincronizadaValida: 0, surtidoEfectivo: 10 })
    expect(r.lineas[1]).toMatchObject({ cantidadSurtidaManual: 0, cantidadSincronizadaValida: 10, surtidoEfectivo: 10 })

    // max(totalManual=10, totalSincronizado=10) daría 10 — el máximo global
    // es incorrecto porque son piezas distintas en líneas distintas.
    expect(r.resumen.surtidoEfectivo).toBe(20)
    expect(r.resumen.surtidoEfectivo).not.toBe(10)
  })

  it('16. Pedido completamente surtido (efectivo = solicitada) → pendiente 0', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRB'], cantidad: 10, cantidadSurtida: 10 }],
    }
    const r = calcularProgresoPedido(pedido, [])
    expect(r.resumen.cantidadPendiente).toBe(0)
    expect(r.resumen.porcentajeEfectivo).toBe(100)
  })

  it('17. Sobre-surtido: no truena, pendiente se queda en 0 y el porcentaje refleja el exceso sin ocultarlo', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRB'], cantidad: 10, cantidadSurtida: 15 }], // manual ya excede lo solicitado
    }
    const r = calcularProgresoPedido(pedido, [])
    expect(r.resumen.cantidadPendiente).toBe(0)
    expect(r.resumen.surtidoEfectivo).toBe(15)
    expect(r.resumen.porcentajeEfectivo).toBeGreaterThan(100) // no se recorta a 100 en silencio
  })

  it('18. Link cuyo pallet ya no existe → advertencia, no cuenta, no truena', () => {
    const vinculos = [{ link: link({ palletId: 'FANTASMA' }), pallet: null }]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.palletsVinculados).toBe(0)
    expect(r.advertencias).toContainEqual({ tipo: 'pallet_no_encontrado', palletId: 'FANTASMA' })
  })

  it('19. Porcentaje con cantidad solicitada cero no truena ni da NaN', () => {
    const pedido = { televisiones: [] }
    const r = calcularProgresoPedido(pedido, [])
    expect(r.resumen.cantidadSolicitada).toBe(0)
    expect(r.resumen.porcentajeManual).toBe(0)
    expect(r.resumen.porcentajeSincronizado).toBe(0)
    expect(r.resumen.porcentajeEfectivo).toBe(0)
    expect(Number.isNaN(r.resumen.porcentajeEfectivo)).toBe(false)
  })

  it('producto sin condición informada → discrepancia explícita, no se descarta en silencio', () => {
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'SNTV007618', condicion: '', cantidad: 3 }] })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.discrepancias).toContainEqual({ sku: 'SNTV007618', condicion: '', cantidad: 3, motivo: 'sin_condicion' })
  })

  it('cantidad inválida en un producto genera advertencia y no se suma al pool', () => {
    const vinculos = [vinculo({
      palletId: 'A',
      productos: [
        { sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: -3 },
        { sku: 'SNTV007618-GRB', condicion: 'GRB', cantidad: 5 },
      ],
    })]
    const r = calcularProgresoPedido(pedidoAceptacion(), vinculos)
    expect(r.resumen.cantidadSincronizadaValida).toBe(5) // solo la cantidad válida cuenta
    expect(r.advertencias).toContainEqual({ tipo: 'cantidad_invalida', palletId: 'A', sku: 'SNTV007618-GRB' })
  })

  it('línea sin límite: sincronizada no capea, pendiente es null (mismo criterio que calcularTotales)', () => {
    const pedido = {
      televisiones: [{ modelo: 'X', condiciones: ['GRB'], cantidad: 0, sinLimite: true, cantidadSurtida: 2 }],
    }
    const vinculos = [vinculo({ palletId: 'A', productos: [{ sku: 'X-GRB', condicion: 'GRB', cantidad: 9 }] })]
    const r = calcularProgresoPedido(pedido, vinculos)
    expect(r.lineas[0].cantidadSolicitada).toBeNull()
    expect(r.lineas[0].cantidadPendiente).toBeNull()
    expect(r.lineas[0].cantidadSincronizadaValida).toBe(9)
    expect(r.lineas[0].surtidoEfectivo).toBe(9)
  })
})
