import { localeDe } from '@/lib/intl-format'

export function formatMoneda(total, moneda, lang) {
  if (total === null || total === undefined) return '—'
  try {
    return new Intl.NumberFormat(localeDe(lang), { style: 'currency', currency: moneda || 'MXN' }).format(total)
  } catch {
    return `${total} ${moneda || ''}`.trim()
  }
}

export function formatFecha(iso, lang) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(fecha)
}

export function formatFechaCorta(iso, lang) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}
