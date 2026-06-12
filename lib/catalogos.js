export const MARCAS = [
  'Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Sharp', 'Vizio',
  'Panasonic', 'ONN', 'Roku TV', 'Westinghouse', 'Insignia', 'Element',
  'Sceptre', 'JVC', 'Aiwa', 'RCA', 'Toshiba', 'Hitachi', 'Skyworth',
  'Polaroid', 'Hyundai', 'Daewoo', 'Konka', 'Chiq', 'Blaupunkt', 'Grundig',
]

export const PULGADAS = [24, 32, 40, 43, 50, 55, 58, 60, 65, 70, 75, 85, 86, 98, 100]

export const CONDICIONES = [
  'GRA', 'GRB', 'GRC',
  'ICB', 'ICC', 'ICD', 'ICX',
  'BOX', 'DNP', 'DMT', 'DMA',
]

export const UNIDADES = ['pieza', 'pallet']

export const SKU_REGEX = /^[A-Za-z0-9]{3,20}$/

export function skuValido(sku) {
  return typeof sku === 'string' && SKU_REGEX.test(sku)
}

// Devuelve "pieza/piezas" o "pallet/pallets" según cantidad y unidad
export function unidadLabel(cantidad, unidad, mayuscula = false) {
  let label
  if (unidad === 'pallet') {
    label = cantidad === 1 ? 'pallet' : 'pallets'
  } else {
    label = cantidad === 1 ? 'pieza' : 'piezas'
  }
  return mayuscula ? label.toUpperCase() : label
}
