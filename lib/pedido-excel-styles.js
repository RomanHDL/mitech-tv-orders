// Paleta y categorías visuales del reporte Excel "Avance del pedido" — una
// sola fuente de verdad para lib/pedido-excel-workbook.js. Colores en ARGB
// (prefijo FF de opacidad total) tal como los pide ExcelJS.
export const COLOR = {
  navMarino: 'FF17365D', // encabezados
  azulOscuro: 'FF2F75B5', // solicitado — texto/marca
  azulClaro: 'FFD9EAF7', // solicitado — fondo (valor numérico real)
  azulMuyClaro: 'FFEDF5FB', // solicitado — fondo (texto: meta compartida / por definir)
  verde: 'FF00A65A', // surtido — texto
  verdeClaro: 'FFE2F4EA', // surtido — fondo
  naranja: 'FFE67E22', // pendiente — texto
  naranjaClaro: 'FFFCE8D5', // pendiente — fondo
  naranjaMuySuave: 'FFFDF2E9', // estado "en proceso" — fondo
  morado: 'FF6D5BD0', // meta compartida / parcial / por definir (estado) — texto
  moradoClaro: 'FFECE9FF', // meta compartida / parcial / por definir (estado) — fondo
  rojo: 'FFC0392B', // excedido — texto
  rojoClaro: 'FFFDEBEA', // excedido — fondo
  gris: 'FF666666', // sin iniciar / sin solicitud — texto
  grisClaro: 'FFF0F0F0', // sin iniciar / sin solicitud — fondo
  grisLeyenda: 'FFF2F2F2', // fondo de la leyenda final
  cremaSku: 'FFFFFBEA', // fondo de la celda SKU (para que resalte)
  blanco: 'FFFFFFFF',
  negro: 'FF1A1A1A',
  bordeSuave: 'FFE2E4E7',
  amarilloCondicion: 'FFF1C40F', // condición GRB
}

// Categoría visual → { bg, font } — compartida entre el estado de GRUPO
// (GROUP_STATUS) y el estado de SKU (ESTADO_SKU_CLASE de
// lib/surtido-grupos.js): ambos se traducen a una de estas 8 categorías
// antes de llegar aquí (ver categoriaEstadoGrupo/categoriaEstadoSku en
// lib/pedido-excel.js), así que el workbook nunca necesita conocer los
// códigos crudos de negocio.
export const ESTADO_COLOR = {
  completo: { bg: COLOR.verdeClaro, font: COLOR.verde },
  'en-proceso': { bg: COLOR.naranjaMuySuave, font: COLOR.naranja },
  'sin-iniciar': { bg: COLOR.grisClaro, font: COLOR.gris },
  pendiente: { bg: COLOR.naranjaClaro, font: COLOR.naranja },
  parcial: { bg: COLOR.moradoClaro, font: COLOR.morado },
  'por-definir': { bg: COLOR.moradoClaro, font: COLOR.morado },
  excedido: { bg: COLOR.rojoClaro, font: COLOR.rojo },
  'sin-solicitud': { bg: COLOR.grisClaro, font: COLOR.gris },
}

// Color de texto por condición — solo las 3 con color asignado
// explícitamente; cualquier otra condición (BOX, ICB, ICC...) se queda en
// negrita sin color especial, nunca se pierde el texto.
export const CONDICION_COLOR = {
  GRA: COLOR.verde,
  GRB: COLOR.amarilloCondicion,
  GRC: COLOR.rojo,
}

export const ANCHOS_COLUMNA = [5, 24, 18, 17, 15, 15, 17]

export const ALTO_FILA = {
  titulo: 30,
  subtitulo: 20,
  resumenTexto: 18,
  statBlock: 42,
  progresoTexto: 18,
  encabezadoColumnas: 22,
  marca: 26,
  grupo: 22,
  sku: 20,
  leyenda: 18,
}
