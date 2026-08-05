// Catálogo semilla/sugerido — YA NO es la lista cerrada de marcas válidas
// (ver marcaValida). Sigue siendo el punto de partida del selector de marca
// y de la normalización de casing en importaciones (lib/importar-pedido.js).
export const MARCAS = [
  'Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Sharp', 'Vizio',
  'Panasonic', 'ONN', 'Roku TV', 'Westinghouse', 'Insignia', 'Element',
  'Sceptre', 'JVC', 'Aiwa', 'RCA', 'Toshiba', 'Hitachi', 'Skyworth',
  'Polaroid', 'Hyundai', 'Daewoo', 'Konka', 'Chiq', 'Blaupunkt', 'Grundig',
]

// Formato aceptado para una marca (nueva o del catálogo): letras (con
// acentos), números, espacios, punto, ampersand y guion. 1-40 caracteres.
// Reemplaza la validación anterior (MARCAS.includes(marca)) — el catálogo
// de arriba es solo una sugerencia inicial, cualquier pedido puede
// introducir una marca nueva (ver GET /api/marcas para el catálogo
// dinámico real, derivado de las marcas ya usadas).
export const MARCA_REGEX = /^[\p{L}0-9][\p{L}0-9 .&-]{0,39}$/u

export function marcaValida(marca) {
  return typeof marca === 'string' && MARCA_REGEX.test(marca.trim())
}

export const PULGADAS = [24, 32, 40, 43, 50, 55, 58, 60, 65, 70, 75, 85, 86, 98, 100]

// Catálogo único de condición: se usa tanto para pedido.condiciones (tag
// general del pedido, derivado de las TVs) como para tv.condicion (por
// partida/SKU). Ya no hay dos catálogos separados con reglas distintas —
// cualquier valor de esta lista es válido en ambos niveles.
export const CONDICIONES = [
  'GRA', 'GRB', 'GRC', 'BOX',
  'ICB', 'ICC', 'ICD', 'ICX',
  'DMA', 'DMT', 'DNP',
]

// Subconjunto que se muestra como acceso directo ("chips") en el selector
// de condición activa; el resto se ofrece en el desplegable "Más condiciones".
export const CONDICIONES_FRECUENTES = ['GRA', 'GRB', 'GRC', 'BOX']

export const UNIDADES = ['pieza', 'pallet']

export const SKU_REGEX = /^[A-Za-z0-9]{3,20}$/

export function skuValido(sku) {
  return typeof sku === 'string' && SKU_REGEX.test(sku)
}

// Devuelve "pieza/piezas" o "pallet/pallets" según cantidad y unidad, en el
// idioma de quien llama. `t` es la función de traducción del llamador (hook
// useTranslation en cliente, getServerT() de lib/i18n-server.js en Server
// Components) — nunca se guarda/reutiliza texto final, solo el código.
export function unidadLabel(t, cantidad, unidad, mayuscula = false) {
  const clave = unidad === 'pallet' ? 'pallet' : 'pieza'
  const label = t(`unidad.${clave}`, { count: cantidad })
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

// Etiqueta de estado operativo en el idioma de quien llama — mismo patrón
// que unidadLabel: `t` viene del hook (cliente) o de getServerT() (servidor).
export function estadoLabel(t, estado) {
  return t(`estados.${estado}`)
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

// Etiqueta de tipo de evento en el idioma de quien llama — mismo patrón
// que estadoLabel/unidadLabel.
export function tipoEventoLabel(t, tipo) {
  return t(`tiposEvento.${tipo}`)
}
