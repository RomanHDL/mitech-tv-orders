// Puerto de descargarPedidosXLSX (app/pedidos/lista-cliente.jsx) a TS.
// Una hoja "Historial" (resumen) + una hoja por pedido.
import * as XLSX from 'xlsx'
import type { PedidoConTvs } from '@shared/schema'
import { totalRequerido, totalSurtido, diasHastaLimite, tiempoRestanteTexto, formatearFechaHora } from './pedido-stats'

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

export function descargarPedidosXLSX(pedidos: PedidoConTvs[]) {
  const wb = XLSX.utils.book_new()

  const historialEncabezados = [
    'Número de pedido', 'Pedido', 'Fecha creación', 'Fecha límite', 'Tiempo restante',
    'Dueño', 'Condiciones', 'Modelos', 'Cantidad requerida', 'Cantidad surtida', 'Progreso', 'Estado',
  ]
  const historialFilas = pedidos.map((p) => {
    const requerido = totalRequerido(p)
    const surtido = totalSurtido(p.televisiones)
    const pct = requerido > 0 ? Math.round((surtido / requerido) * 100) : 0
    const estado = pct >= 100 ? 'Completado' : pct > 0 ? 'Parcial' : 'Pendiente'
    const tiempo = tiempoRestanteTexto(diasHastaLimite(p.fechaLimite)).texto
    return [
      p.numeroPedido || '',
      p.pedidoNombre,
      formatearFechaHora(p.fecha),
      p.fechaLimite,
      tiempo,
      p.creadoPorNombre || '',
      (p.condiciones || []).join(' / '),
      p.televisiones.length,
      requerido,
      surtido,
      `${pct}%`,
      estado,
    ]
  })
  const wsHistorial = XLSX.utils.aoa_to_sheet([historialEncabezados, ...historialFilas])
  wsHistorial['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial')

  const nombresUsados = new Set(['historial'])
  for (const p of pedidos) {
    const tvs = p.televisiones
    const encabezadoInfo = [
      ['Número de pedido', p.numeroPedido || ''],
      ['Pedido', p.pedidoNombre],
      ['Fecha creación', formatearFechaHora(p.fecha)],
      ['Fecha límite', p.fechaLimite || ''],
      ['Tiempo restante', tiempoRestanteTexto(diasHastaLimite(p.fechaLimite)).texto],
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
