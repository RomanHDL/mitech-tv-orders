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
      { brand: 'ONN', model: 'SNTV001763', qty: '3', pulgadas: '', condicion: 'GRB' },
      { brand: 'ONN', model: 'SNTV001764', qty: '44', pulgadas: '', condicion: 'GRA' },
      { brand: 'ONN', model: 'SNTV001862', qty: '2', pulgadas: '', condicion: 'GRC' },
      { brand: 'TCL', model: 'SNTV002033', qty: '4', pulgadas: '', condicion: 'GRB' },
    ])
  })

  it('filasAItems arma los items con condición y sin pulgadas (no vienen en el SKU ni en la tabla)', () => {
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

// Formato real completo con la columna PULGADAS incluida (SKU, QTY, TIPO DE
// TV (MARCA), PULGADAS, CONDICIÓN) — la tabla "limpia" que el cliente termina
// mandando una vez que ya tiene las pulgadas de cada SKU.
describe('parsearTexto — formato con PULGADAS incluida', () => {
  const tabla = [
    'SKU\tQTY\tTIPO DE TV (MARCA)\tPULGADAS\tCONDICIÓN',
    'SNTV001763\t3\tONN\t50"\tGRB',
    'SNTV001764\t44\tONN\t32"\tGRA',
    'SNTV003414\t2\tONN\t40"\tGRB',
  ].join('\n')

  it('toma la pulgada de su propia columna (con comillas incluidas) en vez de intentar detectarla del SKU', () => {
    const items = filasAItems(parsearTexto(tabla))
    expect(items).toMatchObject([
      { modelo: 'SNTV001763', cantidad: 3, pulgadas: 50, condicion: 'GRB' },
      { modelo: 'SNTV001764', cantidad: 44, pulgadas: 32, condicion: 'GRA' },
      { modelo: 'SNTV003414', cantidad: 2, pulgadas: 40, condicion: 'GRB' },
    ])
    expect(items.every((it) => it._flags.pulgadasOk)).toBe(true)
  })

  it('también funciona sin las comillas de pulgadas', () => {
    const sinComillas = tabla.replaceAll('"', '')
    const items = filasAItems(parsearTexto(sinComillas))
    expect(items.map((it) => it.pulgadas)).toEqual([50, 32, 40])
  })
})

describe('parsearTexto — rescate por contenido cuando el encabezado viene con ruido (típico del OCR de una foto)', () => {
  it('si el encabezado de QTY y CONDICIÓN es irreconocible, los infiere del valor de cada celda', () => {
    const tabla = [
      'SKU\t###\tTIPO DE TV (MARCA)\t@@@',
      'SNTV001763\t3\tONN\tGRB',
      'SNTV001764\t44\tONN\tGRA',
      'SNTV001862\t2\tONN\tGRC',
    ].join('\n')
    expect(parsearTexto(tabla)).toEqual([
      { brand: 'ONN', model: 'SNTV001763', qty: '3', pulgadas: '', condicion: 'GRB' },
      { brand: 'ONN', model: 'SNTV001764', qty: '44', pulgadas: '', condicion: 'GRA' },
      { brand: 'ONN', model: 'SNTV001862', qty: '2', pulgadas: '', condicion: 'GRC' },
    ])
  })

  it('filasAItems ya no cae en cantidad=1/condición vacía cuando el rescate por contenido aplica', () => {
    const tabla = 'SKU\t###\tMARCA\t@@@\nSNTV001764\t44\tONN\tGRA'
    const items = filasAItems(parsearTexto(tabla))
    expect(items[0]).toMatchObject({ cantidad: 44, condicion: 'GRA' })
  })

  it('rescata también PULGADAS por contenido cuando su encabezado es irreconocible, sin confundirla con QTY', () => {
    const tabla = [
      'SKU\tQTY\tMARCA\t%%%\tCONDICIÓN',
      'SNTV001763\t3\tONN\t50"\tGRB',
      'SNTV003414\t2\tONN\t40"\tGRB',
    ].join('\n')
    const items = filasAItems(parsearTexto(tabla))
    expect(items).toMatchObject([
      { cantidad: 3, pulgadas: 50, condicion: 'GRB' },
      { cantidad: 2, pulgadas: 40, condicion: 'GRB' },
    ])
  })
})

describe('detectarEncabezado (vía parsearTexto) — coincidencia parcial de encabezados con ruido', () => {
  it('reconoce variantes con acentos/paréntesis/dos puntos y abreviaturas', () => {
    const tabla = [
      'Sku:\tCant.\tTipo de TV\tCondición:',
      'SNTV001763\t3\tONN\tGRB',
    ].join('\n')
    expect(parsearTexto(tabla)).toEqual([
      { brand: 'ONN', model: 'SNTV001763', qty: '3', pulgadas: '', condicion: 'GRB' },
    ])
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
      { brand: 'Hisense', model: '75A6H', qty: '5', pulgadas: '', condicion: '' },
      { brand: 'Samsung', model: 'DU7000', qty: '10', pulgadas: '', condicion: '' },
    ])
  })
})
