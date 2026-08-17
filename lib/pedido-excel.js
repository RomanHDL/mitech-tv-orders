// Construye el CONTENIDO ESTRUCTURADO de la exportación a Excel del avance
// de UN pedido — agrupado marca → pulgadas → SKU, la misma fuente de
// verdad que ya usan Surtir y la hoja de impresión (lib/surtido-grupos.js).
// Deliberadamente puro y sin `exceljs`: esto solo describe QUÉ mostrar y en
// qué categoría visual cae cada valor (para que el estilo se aplique
// aparte, en lib/pedido-excel-workbook.js) — así se puede probar sin DOM,
// sin navegador y sin generar ningún archivo real.
import {
  ESTADO_SKU_CLASE,
  GROUP_STATUS,
  calcularAvanceSku,
  calculateBrandSummary,
  calculateOrderSummary,
  groupProductsByBrandAndSize,
  groupStatusLabel,
  isRequestedQuantityDefined,
  skuEstadoLabel,
} from './surtido-grupos'

// GROUP_STATUS → categoría visual compartida con el estado de SKU (ver
// ESTADO_COLOR en lib/pedido-excel-styles.js).
const CATEGORIA_ESTADO_GRUPO = {
  [GROUP_STATUS.UNDEFINED]: 'por-definir',
  [GROUP_STATUS.NOT_STARTED]: 'sin-iniciar',
  [GROUP_STATUS.IN_PROGRESS]: 'en-proceso',
  [GROUP_STATUS.COMPLETE]: 'completo',
  [GROUP_STATUS.EXCEEDED]: 'excedido',
}

function categoriaEstadoGrupo(status) {
  return CATEGORIA_ESTADO_GRUPO[status] || 'sin-iniciar'
}

// ESTADO_SKU_CLASE ya usa exactamente estas categorías ('completo',
// 'parcial', 'pendiente', 'sin-solicitud') — se reutiliza tal cual.
function categoriaEstadoSku(estado) {
  return ESTADO_SKU_CLASE[estado] || 'pendiente'
}

// Nombre de archivo seguro: sin caracteres prohibidos en sistemas de
// archivos, con el número de pedido cuando existe para evitar choques
// entre pedidos con el mismo nombre.
function nombreArchivoSeguro(pedido) {
  const base = pedido.numeroPedido ? `${pedido.numeroPedido}-${pedido.pedidoNombre}` : pedido.pedidoNombre
  return `pedido-${String(base).replace(/[\\/:*?"<>|]/g, '-').trim()}.xlsx`
}

// Texto para la celda SOLICITADO de UN SKU — nunca inventa una meta:
// { tipo: 'numero', valor } | { tipo: 'metaCompartida' } | { tipo: 'porDefinir' }
function solicitadoSku(avance, t) {
  if (avance.solicitada !== null) return { tipo: 'numero', valor: avance.solicitada }
  if (avance.metaCompartida) return { tipo: 'metaCompartida', valor: t('imprimir.metaCompartida').toUpperCase() }
  return { tipo: 'porDefinir', valor: t('surtir.grupo.porDefinir').toUpperCase() }
}

// Texto para la celda PENDIENTE de un SKU — solo existe cuando ese SKU
// tiene una meta propia (grupo de un único SKU); en meta compartida o
// grupo por definir se muestra "—", nunca se inventa.
function pendienteSku(avance) {
  if (avance.pendiente === null) return { tipo: 'vacio' }
  return { tipo: 'numero', valor: avance.pendiente }
}

export function construirReportePedido(pedido, t) {
  const televisiones = pedido.televisiones || []
  const brandSections = groupProductsByBrandAndSize(televisiones, pedido.metasGrupo)
  const orderSummary = calculateOrderSummary(brandSections)
  const progresoPct = orderSummary.totalRequestedDefined > 0
    ? Math.round((orderSummary.totalSuppliedDefined / orderSummary.totalRequestedDefined) * 100)
    : 0

  const subtitulo = pedido.numeroPedido
    ? `${pedido.pedidoNombre} · ${t('pedidos.colNumeroPedido')} ${pedido.numeroPedido}`
    : pedido.pedidoNombre

  const marcas = brandSections.map((brand) => {
    const resumenMarca = calculateBrandSummary(brand)
    const grupos = brand.sizes.map((group) => {
      const requestedDefinido = isRequestedQuantityDefined(group.requested)
      const pendingDefinido = group.summary.pending !== null && group.summary.pending !== undefined

      const skus = group.products.map((tv, i) => {
        const avance = calcularAvanceSku(tv, group)
        return {
          numero: i + 1,
          modelo: tv.modelo || '—',
          condiciones: tv.condiciones || [],
          solicitado: solicitadoSku(avance, t),
          surtido: avance.surtida,
          pendiente: pendienteSku(avance),
          estado: {
            categoria: categoriaEstadoSku(avance.estado),
            texto: skuEstadoLabel(t, avance.estado),
          },
        }
      })

      return {
        etiqueta: `${group.brand} ${group.size}" · ${t('surtir.grupo.skuCount', { count: group.products.length })}`,
        solicitado: requestedDefinido
          ? { tipo: 'numero', valor: group.requested }
          : { tipo: 'porDefinir', valor: t('surtir.grupo.porDefinir').toUpperCase() },
        surtido: group.summary.supplied,
        pendiente: pendingDefinido ? { tipo: 'numero', valor: group.summary.pending } : { tipo: 'vacio' },
        estado: {
          categoria: categoriaEstadoGrupo(group.summary.status),
          texto: groupStatusLabel(t, group.summary.status, group.summary.excess),
        },
        skus,
      }
    })

    return {
      etiqueta: brand.label.toUpperCase(),
      resumenTexto: `${brand.label.toUpperCase()} · ${t('surtir.grupo.skuCount', { count: resumenMarca.skuCount })} · `
        + `${t('common.solicitado')} ${resumenMarca.requestedDefinedTotal} · `
        + `${t('common.surtido')} ${resumenMarca.suppliedTotal} · `
        + `${t('common.pendiente')} ${resumenMarca.pendingTotal}`,
      grupos,
    }
  })

  return {
    nombreArchivo: nombreArchivoSeguro(pedido),
    nombreHoja: 'Avance Pedido',
    encabezado: {
      titulo: t('excelPedido.tituloPrincipal'),
      subtitulo,
    },
    resumen: {
      totalSku: televisiones.length,
      totalSolicitado: orderSummary.totalRequestedDefined,
      totalSurtido: orderSummary.totalSupplied,
      totalPendiente: orderSummary.totalPending,
      progresoPct,
      tituloSeccion: t('excelPedido.avanceGeneral'),
      etiquetaSkuTotales: t('excelPedido.skuTotales'),
      etiquetaSolicitadas: t('excelPedido.solicitadas'),
      etiquetaSurtidas: t('excelPedido.surtidas'),
      etiquetaPendientes: t('excelPedido.pendientes'),
      textoProgreso: t('excelPedido.progresoTexto', {
        pct: progresoPct,
        surtido: orderSummary.totalSupplied,
        solicitado: orderSummary.totalRequestedDefined,
        pendiente: orderSummary.totalPending,
      }),
    },
    columnas: {
      numero: t('excelPedido.colNumero'),
      sku: t('excelPedido.colSku'),
      condicion: t('excelPedido.colCondicion'),
      solicitado: t('excelPedido.colSolicitado'),
      surtido: t('excelPedido.colSurtido'),
      pendiente: t('excelPedido.colPendiente'),
      estado: t('excelPedido.colEstado'),
    },
    marcas,
    leyenda: t('excelPedido.leyenda'),
  }
}
