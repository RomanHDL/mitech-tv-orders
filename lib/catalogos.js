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

// Condiciones oficiales por partida/SKU (distinto de CONDICIONES, que es el
// tag general del pedido). Exclusivamente estas 3 — no agregar más sin
// autorización explícita. Igual que en el MI Stack (rewrite-mi-stack).
export const CONDICIONES_PARTIDA = ['GRA', 'GRB', 'GRC']

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

// ─── Estado operativo (ciclo logístico) ──────────────────────────────
//
// Independiente del progreso de surtido (que sigue derivándose de
// cantidad/cantidadSurtida). Los primeros 3 valores (PENDIENTE/EN_PROCESO/
// TERMINADO) casi siempre se derivan solos del progreso; los 3 últimos
// (CARGANDO/LISTO_SALIDA/DESPACHADO) y CANCELADO solo se alcanzan por
// acción explícita de un admin/surtidor — nunca se inventan ni se infieren.
export const ESTADOS_OPERATIVOS = [
  'PENDIENTE',
  'EN_PROCESO',
  'TERMINADO',
  'CARGANDO',
  'LISTO_SALIDA',
  'DESPACHADO',
  'CANCELADO',
]

export const ESTADO_LABEL = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  TERMINADO: 'Surtido terminado',
  CARGANDO: 'Cargando',
  LISTO_SALIDA: 'Listo para salida',
  DESPACHADO: 'Despachado',
  CANCELADO: 'Cancelado',
}

// Jerarquía: un estado avanzado nunca retrocede aunque el progreso derivado
// "baje" (ej. se edite el pedido y agregue más piezas). CANCELADO no entra
// en esta jerarquía — es un estado terminal aparte, se maneja por separado.
export const ESTADO_ORDEN = {
  PENDIENTE: 0,
  EN_PROCESO: 1,
  TERMINADO: 2,
  CARGANDO: 3,
  LISTO_SALIDA: 4,
  DESPACHADO: 5,
}

// Estados que un usuario puede fijar explícitamente vía
// PATCH /api/pedidos/[id]/estado. PENDIENTE/EN_PROCESO/TERMINADO no están
// aquí a propósito: esos tres siempre se derivan solos del progreso de
// surtido, nunca se fijan a mano.
export const ESTADOS_TRANSICION = ['CARGANDO', 'LISTO_SALIDA', 'DESPACHADO', 'CANCELADO']

// ─── Tipos de evento del historial/auditoría ─────────────────────────
// Cada mutación real de un pedido escribe un documento en la colección
// `eventos` (ver lib/eventos.js) con uno de estos tipos. Nunca se inventan
// eventos: solo se registran cuando ocurre la acción real correspondiente.
export const TIPOS_EVENTO = [
  'CREACION',
  'CAMBIO_ESTADO',
  'EDICION',
  'SURTIDO',
  'CARGA',
  'DESPACHO',
  'CANCELACION',
  'CAMBIO_DUENO',
  'CAMBIO_CANTIDADES',
  'OTRO',
]

export const TIPO_EVENTO_LABEL = {
  CREACION: 'Creación',
  CAMBIO_ESTADO: 'Cambio de estado',
  EDICION: 'Edición',
  SURTIDO: 'Surtido',
  CARGA: 'Carga',
  DESPACHO: 'Despacho',
  CANCELACION: 'Cancelación',
  CAMBIO_DUENO: 'Cambio de dueño',
  CAMBIO_CANTIDADES: 'Cambio de cantidades',
  OTRO: 'Otro',
}
