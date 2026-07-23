import * as XLSX from 'xlsx'
import { etiquetaEstado, etiquetaTipo, formatearFechaHora } from './eventos-helpers'
import { detalleLabel, detalleSecundarioLabel } from '@/lib/eventos-labels'

// Excel de Historial — usa /api/eventos?todos=1 (respeta los filtros
// activos, sin paginación, con el mismo tope duro del servidor) y enriquece
// cada fila con los totales ACTUALES del pedido (solicitado/surtido/
// pendiente/unidad) vía /api/eventos/pedido/:id — solo para los pedidos
// distintos que aparecen en el resultado, nunca uno por fila repetida.
export async function exportarEventosExcel(filtros, t, lang) {
  const params = new URLSearchParams({
    q: filtros.busqueda || '',
    desde: filtros.desde || '',
    hasta: filtros.hasta || '',
    estado: filtros.estadoFiltro || 'todos',
    tipo: filtros.tipoFiltro || 'todos',
    usuario: filtros.usuarioFiltro || 'todos',
    condicion: filtros.condicionFiltro || 'todos',
    categoria: filtros.categoria || 'todos',
    todos: '1',
  })
  const res = await fetch(`/api/eventos?${params}`)
  if (!res.ok) throw new Error(t('historial.errorCarga'))
  const { eventos } = await res.json()

  const idsUnicos = [...new Set(eventos.map((e) => e.pedidoId))]
  const totalesPorPedido = new Map()
  await Promise.all(
    idsUnicos.map(async (id) => {
      try {
        const r = await fetch(`/api/eventos/pedido/${id}`)
        if (!r.ok) return
        const d = await r.json()
        totalesPorPedido.set(id, d.pedido)
      } catch {
        // Si un pedido puntual falla (borrado, permisos), la fila igual se
        // exporta con las columnas de totales en blanco — no se descarta.
      }
    })
  )

  const encabezados = [
    t('historial.colFechaHora'), t('historial.colNumeroPedido'), t('historial.colPedido'), t('historial.colEvento'),
    t('historial.colEstadoAnterior'), t('historial.colEstadoNuevo'), t('historial.colUsuario'), t('historial.colDetalle'), t('historial.colCondicion'),
    t('common.solicitado'), t('common.surtido'), t('common.pendiente'), t('historial.colUnidad'), t('historial.colObservacion'),
  ]

  const filas = eventos.map((e) => {
    const p = totalesPorPedido.get(e.pedidoId)
    return [
      formatearFechaHora(e.creadoEn, lang),
      e.numeroPedido || '',
      e.pedidoNombre || '',
      `${etiquetaTipo(t, e.tipo)}: ${detalleLabel(t, e)}`,
      e.estadoAnterior ? etiquetaEstado(t, e.estadoAnterior) : '—',
      e.estadoNuevo ? etiquetaEstado(t, e.estadoNuevo) : '—',
      e.usuarioNombre || '',
      detalleLabel(t, e) || '',
      (e.condiciones || []).join(' / '),
      p ? p.totalRequerido : '',
      p ? p.totalSurtido : '',
      p ? p.pendiente : '',
      p ? p.unidad : '',
      detalleSecundarioLabel(t, e) || '',
    ]
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas])
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 26 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Historial')

  const hoy = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `historial-pedidos-${hoy}.xlsx`)
}
