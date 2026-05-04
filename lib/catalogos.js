export const MARCAS = [
  'Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Sharp', 'Vizio',
  'Panasonic', 'ONN', 'Roku TV', 'Westinghouse', 'Insignia', 'Element',
  'Sceptre', 'JVC', 'Aiwa', 'RCA', 'Toshiba', 'Hitachi', 'Skyworth',
  'Polaroid', 'Hyundai', 'Daewoo', 'Konka', 'Chiq', 'Blaupunkt', 'Grundig',
]

export const PULGADAS = [32, 40, 43, 50, 55, 58, 60, 65, 70, 75, 85, 86, 98, 100]

// Condiciones agrupadas por categoría (con color para los chips/tags)
export const CONDICIONES_GRUPOS = [
  {
    titulo: 'Estado',
    color: 'success',
    items: ['GRA', 'GRB', 'GRC', 'NUEVO', 'OPEN BOX', 'REACONDICIONADO'],
  },
  {
    titulo: 'Daños',
    color: 'danger',
    items: ['DAÑO ESTÉTICO', 'DAÑO PANTALLA', 'NO ENCIENDE', 'NO IMAGEN'],
  },
  {
    titulo: 'Faltantes',
    color: 'warning',
    items: ['SIN CAJA', 'SIN CONTROL', 'SIN BASE', 'SIN ACCESORIOS'],
  },
  {
    titulo: 'Otros',
    color: 'neutral',
    items: ['EXHIBICIÓN', 'DEVOLUCIÓN', 'LIQUIDACIÓN'],
  },
]

// Lista plana para validación en cliente y servidor
export const CONDICIONES = CONDICIONES_GRUPOS.flatMap((g) => g.items)

// Color asociado a una condición (para tags coloreados)
export function colorDeCondicion(condicion) {
  for (const grupo of CONDICIONES_GRUPOS) {
    if (grupo.items.includes(condicion)) return grupo.color
  }
  return 'neutral'
}

// Ordena condiciones según el orden definido en CONDICIONES_GRUPOS
export function ordenarCondiciones(arr) {
  return [...arr].sort((a, b) => CONDICIONES.indexOf(a) - CONDICIONES.indexOf(b))
}
