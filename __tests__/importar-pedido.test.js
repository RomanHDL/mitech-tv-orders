import { describe, expect, it } from 'vitest'
import { parsearTexto, filasAItems, extraerNumeroPedido } from '@/lib/importar-pedido'

describe('extraerNumeroPedido — número de pedido a partir del título del listado', () => {
  it('lo encuentra en "PEDIDO #19029407 — LISTADO LIMPIO DE TVs"', () => {
    expect(extraerNumeroPedido('PEDIDO #19029407 — LISTADO LIMPIO DE TVs')).toBe('19029407')
  })

  it('funciona en minúsculas y sin "#"', () => {
    expect(extraerNumeroPedido('pedido 12345, revisar antes de mandar')).toBe('12345')
  })

  it('funciona con "Pedido No." y con "Order #"', () => {
    expect(extraerNumeroPedido('Pedido No. 987654')).toBe('987654')
    expect(extraerNumeroPedido('Order #55501')).toBe('55501')
  })

  it('no confunde un SKU o una cantidad con el número de pedido', () => {
    expect(extraerNumeroPedido('SKU\tQTY\tMARCA\nSNTV001763\t3\tONN')).toBe('')
  })

  it('ignora números demasiado cortos (menos de 4 dígitos) para evitar falsos positivos', () => {
    expect(extraerNumeroPedido('Pedido #12')).toBe('')
  })

  it('regresa vacío si no hay nada reconocible', () => {
    expect(extraerNumeroPedido('')).toBe('')
    expect(extraerNumeroPedido('HISENSE\t32H40G\t66')).toBe('')
  })
})

// Caso real reportado: el pedido completo pegado SIN la fila de encabezado
// (el usuario copió solo los 19 renglones de datos), separado por espacios
// múltiples — con 5 columnas y el SKU primero, el heurístico clásico
// (columna0=marca/columna1=modelo) lo desordenaba por completo.
describe('parsearTexto — 5 columnas SIN encabezado (SKU primero) no debe caer al heurístico clásico', () => {
  const texto = [
    'SNTV001763    3    ONN    50"    GRB',
    'SNTV001764    44    ONN    32"    GRA',
    'SNTV001862    2    ONN    43"    GRC',
    'SNTV002033    4    TCL    32"    GRB',
    'SNTV002236    3    ONN    55"    GRB',
    'SNTV003147    21    HISENSE    50"    GRA',
    'SNTV003414    2    ONN    40"    GRB',
    'SNTV004163    2    TCL    50"    GRB',
    'SNTV004278    2    PHILIPS    55"    GRB',
    'SNTV005162    2    PHILIPS    50"    GRB',
    'SNTV005362    2    HISENSE    40"    GRB',
    'SNTV006122    3    TCL    43"    GRC',
    'SNTV007270    2    TCL    50"    GRB',
    'SNTV007398    2    SAMSUNG    55"    GRB',
    'SNTV007563    5    SAMSUNG    32"    GRB',
    'SNTV007822    3    TCL    43"    GRB',
    'SNTV007838    3    TCL    32"    GRB',
    'SNTV008016    4    TCL    55"    GRB',
    'SNTV008284    3    HISENSE    43"    GRB',
  ].join('\n')

  it('parsea las 19 filas completas, con SKU/marca/qty/pulgadas/condición correctos por renglón', () => {
    const items = filasAItems(parsearTexto(texto))
    expect(items).toHaveLength(19)
    expect(items[0]).toMatchObject({ modelo: 'SNTV001763', marca: 'ONN', cantidad: 3, pulgadas: 50, condicion: 'GRB' })
    expect(items[1]).toMatchObject({ modelo: 'SNTV001764', marca: 'ONN', cantidad: 44, pulgadas: 32, condicion: 'GRA' })
    expect(items[5]).toMatchObject({ modelo: 'SNTV003147', marca: 'Hisense', cantidad: 21, pulgadas: 50, condicion: 'GRA' })
    expect(items[18]).toMatchObject({ modelo: 'SNTV008284', marca: 'Hisense', cantidad: 3, pulgadas: 43, condicion: 'GRB' })
    expect(items.every((it) => it._flags.marcaOk && it._flags.skuOk && it._flags.pulgadasOk && it._flags.condicionOk)).toBe(true)
  })

  it('la suma total de piezas coincide con sumar el QTY de las 19 filas (112)', () => {
    const items = filasAItems(parsearTexto(texto))
    const total = items.reduce((s, it) => s + it.cantidad, 0)
    expect(total).toBe(3 + 44 + 2 + 4 + 3 + 21 + 2 + 2 + 2 + 2 + 2 + 3 + 2 + 2 + 5 + 3 + 3 + 4 + 3)
    expect(total).toBe(112)
  })
})

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
