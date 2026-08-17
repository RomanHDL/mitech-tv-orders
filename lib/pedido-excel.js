// Construye el CONTENIDO (filas + fusiones + anchos) de la exportación a
// Excel de UN SOLO pedido — agrupado marca → pulgadas → SKU, la misma
// fuente de verdad que ya usan Surtir y la hoja de impresión
// (lib/surtido-grupos.js). Deliberadamente puro y sin `xlsx`: quien llama
// (un componente cliente) es quien arma el workbook real con
// `XLSX.utils.aoa_to_sheet` — así esta lógica se puede probar sin DOM ni
// navegador, igual que el resto de lib/.
import { cumplimientoTexto, normalizeOrderStatus } from './estado-pedido'
import { estadoLabel } from './catalogos'
import { localeDe } from './intl-format'
import {
  calcularAvanceSku,
  calculateBrandSummary,
  calculateOrderSummary,
  groupProductsByBrandAndSize,
  groupStatusLabel,
  isRequestedQuantityDefined,
  skuEstadoLabel,
} from './surtido-grupos'

const COLUMNAS = 7 // #, SKU/Grupo, Condición, Solicitado, Surtido, Pendiente, Estado

function formatearFecha(iso, lang) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'long', year: 'numeric' }).format(fecha)
}

function formatearFechaLimite(iso, lang) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d))
}

// Nombre de archivo seguro: sin caracteres prohibidos en sistemas de
// archivos, con el número de pedido cuando existe para evitar choques
// entre pedidos con el mismo nombre.
function nombreArchivoSeguro(pedido) {
  const base = pedido.numeroPedido ? `${pedido.numeroPedido}-${pedido.pedidoNombre}` : pedido.pedidoNombre
  return `pedido-${String(base).replace(/[\\/:*?"<>|]/g, '-').trim()}.xlsx`
}

export function construirFilasPedido(pedido, t, lang) {
  const televisiones = pedido.televisiones || []
  const brandSections = groupProductsByBrandAndSize(televisiones, pedido.metasGrupo)
  const orderSummary = calculateOrderSummary(brandSections)
  const progresoPct = orderSummary.totalRequestedDefined > 0
    ? Math.round((orderSummary.totalSuppliedDefined / orderSummary.totalRequestedDefined) * 100)
    : 0
  const estadoPedidoLike = {
    progresoPct,
    estadoOperativo: pedido.estadoOperativo || null,
    pendiente: orderSummary.totalPending,
    fechaLimite: pedido.fechaLimite,
  }
  const estado = normalizeOrderStatus(estadoPedidoLike)
  const cumplimiento = cumplimientoTexto(t, estadoPedidoLike)

  const filas = []
  const merges = []

  function agregarTitulo(texto) {
    merges.push({ s: { r: filas.length, c: 0 }, e: { r: filas.length, c: COLUMNAS - 1 } })
    filas.push([texto])
  }

  agregarTitulo(String(pedido.pedidoNombre || '').toUpperCase())
  filas.push([t('pedidos.colNumeroPedido'), pedido.numeroPedido || '—'])
  filas.push([t('pedidos.colFechaCreacion'), formatearFecha(pedido.fecha, lang)])
  filas.push([t('pedidoForm.fechaLimite'), formatearFechaLimite(pedido.fechaLimite, lang) || '—'])
  filas.push([t('surtir.solicitadoPor').replace(':', ''), pedido.creadoPorNombre || '—'])
  filas.push([t('pedidoForm.condiciones'), (pedido.condiciones || []).join(' / ') || '—'])
  filas.push([t('pedidos.colCumplimiento'), cumplimiento.texto])
  filas.push([t('pedidos.colEstadoOperativo'), estadoLabel(t, estado)])
  filas.push([])

  agregarTitulo(t('imprimir.avanceGeneralTitulo').toUpperCase())
  filas.push([
    t('imprimir.totalSku'),
    t('imprimir.totalSolicitada'),
    t('imprimir.totalSurtida'),
    t('imprimir.totalPendiente'),
    t('pedidos.colPorcentajeSurtido'),
  ])
  filas.push([
    televisiones.length,
    orderSummary.totalRequestedDefined,
    orderSummary.totalSupplied,
    orderSummary.totalPending,
    `${progresoPct}%`,
  ])
  filas.push([])

  agregarTitulo(t('pedidoForm.televisiones').toUpperCase())
  filas.push([
    '#',
    t('pedidoDetalle.colSku'),
    t('pedidoForm.condicion'),
    t('surtir.grupo.solicitadoGrupo'),
    t('surtir.grupo.surtidoGrupo'),
    t('surtir.grupo.pendienteGrupo'),
    t('pedidoDetalle.colEstado'),
  ])

  for (const brand of brandSections) {
    const resumenMarca = calculateBrandSummary(brand)
    agregarTitulo(`${brand.label.toUpperCase()} — ${t('surtir.grupo.skuCount', { count: resumenMarca.skuCount })}`)

    for (const group of brand.sizes) {
      const requestedText = isRequestedQuantityDefined(group.requested) ? group.requested : t('surtir.grupo.porDefinir')
      const pendingText = group.summary.pending === null || group.summary.pending === undefined ? '—' : group.summary.pending
      const estadoGrupoTexto = groupStatusLabel(t, group.summary.status, group.summary.excess)

      filas.push([
        '',
        `${group.brand} ${group.size}"`,
        t('surtir.grupo.skuCount', { count: group.products.length }),
        requestedText,
        group.summary.supplied,
        pendingText,
        estadoGrupoTexto,
      ])

      group.products.forEach((tv, i) => {
        const avance = calcularAvanceSku(tv, group)
        const solicitadaTexto = avance.solicitada === null
          ? (avance.metaCompartida ? t('imprimir.metaCompartida') : t('surtir.grupo.porDefinir'))
          : avance.solicitada
        const pendienteTexto = avance.pendiente === null ? '—' : avance.pendiente

        filas.push([
          i + 1,
          tv.modelo || '—',
          (tv.condiciones || []).join(' / '),
          solicitadaTexto,
          avance.surtida,
          pendienteTexto,
          skuEstadoLabel(t, avance.estado),
        ])
      })
    }
  }

  const colWidths = [
    { wch: 4 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
  ]

  return { filas, merges, colWidths, nombreArchivo: nombreArchivoSeguro(pedido) }
}
