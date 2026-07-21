// Puerto de descargarPedidosXLSX (app/pedidos/lista-cliente.jsx) a TS.
// Una hoja "Historial" (resumen) + una hoja por pedido.
import * as XLSX from 'xlsx'
import { ESTADO_LABEL, type PedidoConTvs, type PedidoEstadoLogRow } from '@shared/schema'
import { totalRequerido, totalSurtido, cumplimientoTexto, estaVencido, formatearFechaHora, normalizeOrderStatus } from './pedido-stats'

type PedidoConHistorial = PedidoConTvs & { historialEstados?: PedidoEstadoLogRow[] }

// Fecha de despacho, si el historial de estados registra esa transición
// (nunca se inventa: si no hay entrada DESPACHADO, se deja vacío).
function fechaDespacho(p: PedidoConHistorial): string {
  const historial = p.historialEstados || []
  const entrada = [...historial].reverse().find((h) => h.estadoNuevo === 'DESPACHADO')
  if (!entrada?.creadoEn) return ''
  return formatearFechaHora(entrada.creadoEn)
}

function sanitizarNombrePestana(nombre: string, usados: Set<string>): string {
  let base = (nombre || 'Pedido').replace(/[\\/?*[\]:]/g, '-').trim()
  if (!base) base = 'Pedido'
  if (base.length > 31) base = base.slice(0, 31)
  let final = base
  let i = 2
  while (usados.has(final.toLowerCase())) {
    const sufijo = ` (${i})`
    final = base.slice(0, 31 - sufijo.length) + sufijo
    i++
  }
  usados.add(final.toLowerCase())
  return final
}

export function descargarPedidosXLSX(pedidos: PedidoConHistorial[]) {
  const wb = XLSX.utils.book_new()

  const historialEncabezados = [
    'Número de pedido', 'Pedido', 'Fecha creación', 'Fecha límite', 'Cumplimiento',
    'Dueño', 'Condiciones', 'Modelos', 'Solicitado', 'Surtido', 'Pendiente', '% Surtido',
    'Estado operativo', 'Vencido', 'Fecha despacho',
  ]
  const historialFilas = pedidos.map((p) => {
    const requerido = totalRequerido(p)
    const surtido = totalSurtido(p.televisiones)
    const pendiente = requerido - surtido
    const pct = requerido > 0 ? Math.round((surtido / requerido) * 100) : 0
    const estado = normalizeOrderStatus({ progresoPct: pct, estadoOperativo: p.estadoOperativo })
    // Nunca exportamos "Vencido" para un pedido ya terminado/cargando/listo/
    // despachado — cumplimientoTexto ya aplica esa prioridad.
    const cumplimiento = cumplimientoTexto({ progresoPct: pct, estadoOperativo: p.estadoOperativo, pendiente, fechaLimite: p.fechaLimite }).texto
    const vencido = estaVencido({ progresoPct: pct, estadoOperativo: p.estadoOperativo, pendiente, fechaLimite: p.fechaLimite })
    return [
      p.numeroPedido || '',
      p.pedidoNombre,
      formatearFechaHora(p.fecha),
      p.fechaLimite,
      cumplimiento,
      p.creadoPorNombre || '',
      (p.condiciones || []).join(' / '),
      p.televisiones.length,
      requerido,
      surtido,
      pendiente,
      `${pct}%`,
      ESTADO_LABEL[estado] || estado,
      vencido ? 'Sí' : 'No',
      fechaDespacho(p),
    ]
  })
  const wsHistorial = XLSX.utils.aoa_to_sheet([historialEncabezados, ...historialFilas])
  wsHistorial['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 9 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial')

  const nombresUsados = new Set(['historial'])
  for (const p of pedidos) {
    const tvs = p.televisiones
    const requerido = totalRequerido(p)
    const surtido = totalSurtido(p.televisiones)
    const pendiente = requerido - surtido
    const pct = requerido > 0 ? Math.round((surtido / requerido) * 100) : 0
    const estado = normalizeOrderStatus({ progresoPct: pct, estadoOperativo: p.estadoOperativo })
    const encabezadoInfo = [
      ['Número de pedido', p.numeroPedido || ''],
      ['Pedido', p.pedidoNombre],
      ['Fecha creación', formatearFechaHora(p.fecha)],
      ['Fecha límite', p.fechaLimite || ''],
      ['Cumplimiento', cumplimientoTexto({ progresoPct: pct, estadoOperativo: p.estadoOperativo, pendiente, fechaLimite: p.fechaLimite }).texto],
      ['Estado operativo', ESTADO_LABEL[estado] || estado],
      ['Dueño', p.creadoPorNombre || ''],
      ['Condiciones', (p.condiciones || []).join(' / ')],
      [],
    ]
    const detalleEncabezados = ['Marca', 'Pulgadas', 'Modelo', 'Unidad', 'Cantidad requerida', 'Cantidad surtida', 'Estado']
    const detalleFilas = tvs.map((tv) => {
      const surt = tv.sinLimite ? tv.cantidadSurtida || 0 : Math.min(tv.cantidad || 0, tv.cantidadSurtida || 0)
      const cantidadLabel = tv.sinLimite ? 'Sin límite' : tv.cantidad
      const estado = tv.sinLimite ? (surt > 0 ? 'Parcial' : 'Pendiente') : surt >= tv.cantidad ? 'Completo' : surt > 0 ? 'Parcial' : 'Pendiente'
      return [tv.marca, tv.pulgadas, tv.modelo, tv.unidad, cantidadLabel, surt, estado]
    })

    const ws = XLSX.utils.aoa_to_sheet([...encabezadoInfo, detalleEncabezados, ...detalleFilas])
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 12 }]
    const baseNombre = p.numeroPedido ? `${p.numeroPedido} - ${p.pedidoNombre}` : p.pedidoNombre
    XLSX.utils.book_append_sheet(wb, ws, sanitizarNombrePestana(baseNombre, nombresUsados))
  }

  const hoy = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `pedidos-${hoy}.xlsx`)
}
