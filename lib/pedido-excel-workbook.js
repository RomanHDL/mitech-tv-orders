// Genera el archivo .xlsx real ("Avance del pedido") a partir del reporte
// puro de lib/pedido-excel.js, aplicando la paleta de lib/pedido-excel-styles.js.
// SOLO SERVIDOR: usa `exceljs` (no `xlsx`), que sí soporta escribir estilos
// de celda, bordes, texto enriquecido y formato condicional (data bars) —
// nunca importar este archivo desde un componente cliente.
import ExcelJS from 'exceljs'
import { construirReportePedido } from './pedido-excel'
import { ALTO_FILA, ANCHOS_COLUMNA, COLOR, CONDICION_COLOR, ESTADO_COLOR } from './pedido-excel-styles'

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function bordeInferior(color = COLOR.bordeSuave) {
  return { bottom: { style: 'thin', color: { argb: color } } }
}

// Aplica el color de la celda SOLICITADO — numérico real (azul estándar) o
// texto de reemplazo como "META COMPARTIDA"/"POR DEFINIR" (azul muy claro,
// nunca inventa un número).
function aplicarSolicitado(cell, solicitado) {
  cell.value = solicitado.valor
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  if (solicitado.tipo === 'numero') {
    cell.fill = fill(COLOR.azulClaro)
    cell.font = { bold: true, color: { argb: COLOR.azulOscuro } }
  } else {
    cell.fill = fill(COLOR.azulMuyClaro)
    cell.font = { bold: true, size: 9, color: { argb: COLOR.azulOscuro } }
  }
}

function aplicarSurtido(cell, valor) {
  cell.value = valor
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  if (valor > 0) {
    cell.fill = fill(COLOR.verdeClaro)
    cell.font = { bold: true, color: { argb: COLOR.verde } }
  } else {
    cell.font = { color: { argb: COLOR.gris } }
  }
}

// Pendiente: naranja si > 0, verde si = 0 (sin pendiente), "—" sin inventar
// un pendiente individual cuando la meta es compartida o está por definir.
function aplicarPendiente(cell, pendiente) {
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  if (pendiente.tipo === 'vacio') {
    cell.value = '—'
    cell.font = { color: { argb: COLOR.gris } }
    return
  }
  cell.value = pendiente.valor
  if (pendiente.valor > 0) {
    cell.fill = fill(COLOR.naranjaClaro)
    cell.font = { bold: true, color: { argb: COLOR.naranja } }
  } else {
    cell.fill = fill(COLOR.verdeClaro)
    cell.font = { bold: true, color: { argb: COLOR.verde } }
  }
}

function aplicarEstado(cell, estado) {
  const colores = ESTADO_COLOR[estado.categoria] || ESTADO_COLOR['sin-iniciar']
  cell.value = estado.texto
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  cell.fill = fill(colores.bg)
  cell.font = { bold: true, color: { argb: colores.font } }
}

// Condición(es) con color por palabra cuando se conoce (GRA/GRB/GRC) — el
// resto se queda en negrita sin color especial, nunca se pierde texto.
function celdaCondiciones(condiciones) {
  if (!condiciones || condiciones.length === 0) return '—'
  const runs = []
  condiciones.forEach((c, i) => {
    if (i > 0) runs.push({ font: { color: { argb: COLOR.gris } }, text: ' / ' })
    const color = CONDICION_COLOR[c]
    runs.push({ font: { bold: true, color: { argb: color || COLOR.negro } }, text: c })
  })
  return { richText: runs }
}

export async function generarWorkbookExcelPedido(pedido, t) {
  const reporte = construirReportePedido(pedido, t)

  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(reporte.nombreHoja, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 9 }],
  })
  ws.columns = ANCHOS_COLUMNA.map((width) => ({ width }))

  // 1) Título principal — A1:G2
  ws.mergeCells('A1:G2')
  const titulo = ws.getCell('A1')
  titulo.value = reporte.encabezado.titulo
  titulo.font = { bold: true, size: 20, color: { argb: COLOR.blanco } }
  titulo.fill = fill(COLOR.navMarino)
  titulo.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = ALTO_FILA.titulo
  ws.getRow(2).height = ALTO_FILA.titulo

  // 2) Subtítulo dinámico — A3:G3
  ws.mergeCells('A3:G3')
  const subtitulo = ws.getCell('A3')
  subtitulo.value = reporte.encabezado.subtitulo
  subtitulo.font = { bold: true, size: 13, color: { argb: COLOR.navMarino } }
  subtitulo.fill = fill(COLOR.azulMuyClaro)
  subtitulo.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(3).height = ALTO_FILA.subtitulo

  // Fila 4: separador en blanco.
  ws.getRow(4).height = 8

  // 3) "AVANCE GENERAL DEL PEDIDO" — A5:G5
  ws.mergeCells('A5:G5')
  const tituloResumen = ws.getCell('A5')
  tituloResumen.value = reporte.resumen.tituloSeccion
  tituloResumen.font = { bold: true, size: 12, color: { argb: COLOR.navMarino } }
  tituloResumen.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(5).height = 20

  // 4) Cuatro bloques de estadísticas — número grande + etiqueta pequeña,
  // en una sola celda con texto enriquecido (2 líneas).
  function bloqueStat(rango, valor, etiqueta, colorTexto, colorFondo) {
    ws.mergeCells(rango)
    const cell = ws.getCell(rango.split(':')[0])
    cell.value = {
      richText: [
        { font: { bold: true, size: 18, color: { argb: colorTexto } }, text: `${valor}\n` },
        { font: { bold: false, size: 9, color: { argb: colorTexto } }, text: etiqueta },
      ],
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = fill(colorFondo)
  }
  bloqueStat('A6:B6', reporte.resumen.totalSku, reporte.resumen.etiquetaSkuTotales, COLOR.azulOscuro, COLOR.azulClaro)
  bloqueStat('C6:D6', reporte.resumen.totalSolicitado, reporte.resumen.etiquetaSolicitadas, COLOR.azulOscuro, COLOR.azulClaro)
  bloqueStat('E6:E6', reporte.resumen.totalSurtido, reporte.resumen.etiquetaSurtidas, COLOR.verde, COLOR.verdeClaro)
  bloqueStat('F6:G6', reporte.resumen.totalPendiente, reporte.resumen.etiquetaPendientes, COLOR.naranja, COLOR.naranjaClaro)
  ws.getRow(6).height = ALTO_FILA.statBlock

  // 5) "41% SURTIDO · 57 de 140 piezas · 83 pendientes" — A7:G7
  ws.mergeCells('A7:G7')
  const progreso = ws.getCell('A7')
  progreso.value = reporte.resumen.textoProgreso
  progreso.font = { bold: true, size: 11, color: { argb: COLOR.negro } }
  progreso.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(7).height = ALTO_FILA.progresoTexto

  // Fila 8: separador en blanco.
  ws.getRow(8).height = 8

  // 6) Encabezado de columnas — A9:G9 (se congela debajo de esta fila)
  const encabezados = [
    reporte.columnas.numero,
    reporte.columnas.sku,
    reporte.columnas.condicion,
    reporte.columnas.solicitado,
    reporte.columnas.surtido,
    reporte.columnas.pendiente,
    reporte.columnas.estado,
  ]
  const filaEncabezado = ws.getRow(9)
  encabezados.forEach((texto, i) => {
    const cell = filaEncabezado.getCell(i + 1)
    cell.value = texto
    cell.font = { bold: true, color: { argb: COLOR.blanco } }
    cell.fill = fill(COLOR.navMarino)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  filaEncabezado.height = ALTO_FILA.encabezadoColumnas

  // 7) Marca → grupo (pulgadas) → SKU. Todo dinámico: nunca se hardcodea
  // ninguna marca ni cantidad de grupos — sale tal cual del reporte.
  let fila = 10
  reporte.marcas.forEach((marca, idxMarca) => {
    ws.mergeCells(`A${fila}:G${fila}`)
    const filaMarca = ws.getRow(fila)
    const cellMarca = filaMarca.getCell(1)
    cellMarca.value = marca.resumenTexto
    cellMarca.font = { bold: true, size: 12, color: { argb: COLOR.blanco } }
    cellMarca.fill = fill(COLOR.azulOscuro)
    cellMarca.alignment = { horizontal: 'center', vertical: 'middle' }
    filaMarca.height = ALTO_FILA.marca
    fila += 1

    marca.grupos.forEach((grupo) => {
      const filaGrupo = ws.getRow(fila)
      filaGrupo.getCell(2).value = grupo.etiqueta
      filaGrupo.getCell(2).font = { bold: true, color: { argb: COLOR.navMarino } }
      filaGrupo.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
      aplicarSolicitado(filaGrupo.getCell(4), grupo.solicitado)
      aplicarSurtido(filaGrupo.getCell(5), grupo.surtido)
      aplicarPendiente(filaGrupo.getCell(6), grupo.pendiente)
      aplicarEstado(filaGrupo.getCell(7), grupo.estado)
      for (let c = 1; c <= 7; c++) filaGrupo.getCell(c).border = bordeInferior()
      filaGrupo.height = ALTO_FILA.grupo
      fila += 1

      const inicioSkuRows = fila
      grupo.skus.forEach((sku) => {
        const filaSku = ws.getRow(fila)
        filaSku.getCell(1).value = sku.numero
        filaSku.getCell(1).font = { color: { argb: COLOR.gris } }
        filaSku.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

        const celdaSku = filaSku.getCell(2)
        celdaSku.value = sku.modelo
        celdaSku.font = { bold: true, color: { argb: COLOR.navMarino } }
        celdaSku.fill = fill(COLOR.cremaSku)
        celdaSku.alignment = { horizontal: 'left', vertical: 'middle' }
        celdaSku.border = { ...bordeInferior(), left: { style: 'medium', color: { argb: COLOR.navMarino } } }

        const celdaCond = filaSku.getCell(3)
        celdaCond.value = celdaCondiciones(sku.condiciones)
        celdaCond.alignment = { horizontal: 'center', vertical: 'middle' }

        aplicarSolicitado(filaSku.getCell(4), sku.solicitado)
        aplicarSurtido(filaSku.getCell(5), sku.surtido)
        aplicarPendiente(filaSku.getCell(6), sku.pendiente)
        aplicarEstado(filaSku.getCell(7), sku.estado)

        for (let c = 1; c <= 7; c++) {
          if (c === 2) continue // ya tiene su propio borde (izquierdo grueso)
          filaSku.getCell(c).border = bordeInferior()
        }
        filaSku.height = ALTO_FILA.sku
        fila += 1
      })
      const finSkuRows = fila - 1

      // Data bar SOLO sobre las cantidades de SKU de este grupo (nunca en
      // encabezados, marca o resumen del grupo) — un rango por grupo.
      ws.addConditionalFormatting({
        ref: `E${inicioSkuRows}:E${finSkuRows}`,
        rules: [
          {
            type: 'dataBar',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: COLOR.verde },
          },
        ],
      })
    })

    // Separación fuerte entre marcas (no después de la última).
    if (idxMarca < reporte.marcas.length - 1) {
      ws.getRow(fila).height = 10
      fila += 1
    }
  })

  // 8) Leyenda final
  fila += 1
  ws.mergeCells(`A${fila}:G${fila}`)
  const leyenda = ws.getCell(`A${fila}`)
  leyenda.value = reporte.leyenda
  leyenda.font = { italic: true, size: 9, color: { argb: COLOR.gris } }
  leyenda.fill = fill(COLOR.grisLeyenda)
  leyenda.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(fila).height = ALTO_FILA.leyenda

  const buffer = await workbook.xlsx.writeBuffer()
  return { buffer, nombreArchivo: reporte.nombreArchivo }
}
