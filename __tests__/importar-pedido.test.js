import { describe, expect, it } from 'vitest'
import { parsearTexto, filasAItems } from '@/lib/importar-pedido'

// Formato de pedido "SKU · QTY · Marca · Condición" — la tabla que envían los
// clientes (SKU, QTY, TIPO DE TV (MARCA), CONDICIÓN), con el SKU primero y la
// marca en tercera columna (orden distinto al clásico Marca/Modelo/Cantidad).
describe('parsearTexto — formato SKU/QTY/Marca/Condición', () => {
  const tabla = [
    'SKU\tQTY\tTIPO DE TV (MARCA)\tCONDICIÓN',
    'SNTV001763\t3\tONN\tGRB',
    'SNTV001764\t44\tONN\tGRA',
    'SNTV001862\t2\tONN\tGRC',
    'SNTV002033\t4\tTCL\tGRB',
  ].join('\n')

  it('respeta el orden de columnas del encabezado, no la posición fija', () => {
    const filas = parsearTexto(tabla)
    expect(filas).toEqual([
      { brand: 'ONN', model: 'SNTV001763', qty: '3', condicion: 'GRB' },
      { brand: 'ONN', model: 'SNTV001764', qty: '44', condicion: 'GRA' },
      { brand: 'ONN', model: 'SNTV001862', qty: '2', condicion: 'GRC' },
      { brand: 'TCL', model: 'SNTV002033', qty: '4', condicion: 'GRB' },
    ])
  })

  it('filasAItems arma los items con condición y sin pulgadas (no vienen en el SKU)', () => {
    const items = filasAItems(parsearTexto(tabla))
    expect(items[0]).toMatchObject({
      marca: 'ONN',
      modelo: 'SNTV001763',
      cantidad: 3,
      condicion: 'GRB',
      pulgadas: '',
    })
    expect(items[0]._flags).toMatchObject({ marcaOk: true, skuOk: true, condicionOk: true, pulgadasOk: false })
    expect(items[1].cantidad).toBe(44)
  })

  it('funciona igual si viene separado por comas (CSV) en vez de tabs', () => {
    const csv = tabla.split('\n').map((l) => l.replaceAll('\t', ',')).join('\n')
    expect(parsearTexto(csv)).toEqual(parsearTexto(tabla))
  })

  it('descarta la fila de Total aunque haya encabezado por columnas', () => {
    const conTotal = tabla + '\nTotal\t53\t\t'
    expect(parsearTexto(conTotal)).toHaveLength(4)
  })
})

describe('parsearTexto — sigue soportando el formato clásico Marca/Modelo/Cantidad', () => {
  it('sin encabezado, usa columna0=marca, columna1=modelo, última numérica=cantidad', () => {
    const texto = 'HISENSE\t32H40G\t66\nONN\t100012585\t194'
    expect(parsearTexto(texto)).toEqual([
      { brand: 'HISENSE', model: '32H40G', qty: 66 },
      { brand: 'ONN', model: '100012585', qty: 194 },
    ])
  })

  it('con encabezado Marca/Modelo/Cantidad, también funciona por columnas', () => {
    const texto = 'Marca\tModelo\tCantidad\nHisense\t75A6H\t5\nSamsung\tDU7000\t10'
    const filas = parsearTexto(texto)
    expect(filas).toEqual([
      { brand: 'Hisense', model: '75A6H', qty: '5', condicion: '' },
      { brand: 'Samsung', model: 'DU7000', qty: '10', condicion: '' },
    ])
  })
})
