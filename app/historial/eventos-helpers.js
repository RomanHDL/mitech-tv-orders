// Helpers puros compartidos entre la tabla, el panel lateral y las
// exportaciones del módulo de Historial — sin JSX, para poder importarse
// también desde exportar-historial.js (Excel) sin arrastrar componentes.
import { ESTADO_LABEL, TIPO_EVENTO_LABEL } from '@/lib/catalogos'

export function formatearFechaHora(fechaIso) {
  if (!fechaIso) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Mexico_City',
    }).format(new Date(fechaIso))
  } catch {
    return '—'
  }
}

export function etiquetaEstado(estado) {
  if (!estado) return '—'
  return ESTADO_LABEL[estado] || estado
}

export function etiquetaTipo(tipo) {
  return TIPO_EVENTO_LABEL[tipo] || tipo
}

// Clave visual (icono + color) del círculo de la primera columna — un solo
// lugar decide esto para que tabla y timeline se vean consistentes.
export function claseEvento(evento) {
  switch (evento.tipo) {
    case 'CREACION': return 'evt-creacion'
    case 'SURTIDO': return evento.estadoNuevo === 'TERMINADO' ? 'evt-terminado' : 'evt-proceso'
    case 'CARGA': return 'evt-carga'
    case 'CAMBIO_ESTADO': return evento.estadoNuevo === 'LISTO_SALIDA' ? 'evt-listo' : 'evt-proceso'
    case 'DESPACHO': return 'evt-despacho'
    case 'EDICION':
    case 'CAMBIO_CANTIDADES': return 'evt-edicion'
    case 'CANCELACION': return 'evt-cancelacion'
    default: return 'evt-otro'
  }
}

export function fechaOffsetISO(dias) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Rangos rápidos: calcula {desde, hasta} en formato 'YYYY-MM-DD'.
export function calcularRango(clave) {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  const fmt = (d) => d.toISOString().slice(0, 10)

  switch (clave) {
    case 'hoy':
      return { desde: fechaOffsetISO(0), hasta: fechaOffsetISO(0) }
    case '7d':
      return { desde: fechaOffsetISO(-6), hasta: fechaOffsetISO(0) }
    case '30d':
      return { desde: fechaOffsetISO(-29), hasta: fechaOffsetISO(0) }
    case 'mes':
      return { desde: fmt(new Date(y, m, 1)), hasta: fechaOffsetISO(0) }
    case 'mesAnterior':
      return { desde: fmt(new Date(y, m - 1, 1)), hasta: fmt(new Date(y, m, 0)) }
    default:
      return { desde: '', hasta: '' }
  }
}
