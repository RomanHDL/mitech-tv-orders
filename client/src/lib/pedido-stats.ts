// Cálculos derivados de un pedido+televisiones — antes se hacían server-side
// en las Server Components de Next (app/pedidos/page.jsx); ahora la API
// manda filas crudas y el cliente calcula (consistente con el resto de la SPA).
import type { PedidoConTvs, TelevisionRow } from '@shared/schema'

// `t` es opcional: si no se pasa (p. ej. en exportar-pedidos.ts, que corre
// fuera de un componente React), cae al texto en español tal cual estaba
// antes de la Fase 8 — no rompe llamadas existentes.
type TFunc = (key: string, opts?: Record<string, unknown>) => string

export function totalRequerido(pedido: PedidoConTvs) {
  const sumaCantidades = pedido.televisiones.reduce((s, tv) => s + (tv.cantidad || 0), 0)
  return typeof pedido.cantidadTotal === 'number' && pedido.cantidadTotal > 0 ? pedido.cantidadTotal : sumaCantidades
}

export function totalSurtido(televisiones: TelevisionRow[]) {
  return televisiones.reduce((s, tv) => {
    const surt = tv.cantidadSurtida || 0
    if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
    return s + Math.min(tv.cantidad || 0, surt)
  }, 0)
}

export function progresoPct(pedido: PedidoConTvs) {
  const req = totalRequerido(pedido)
  const surt = totalSurtido(pedido.televisiones)
  return req > 0 ? Math.round((surt / req) * 100) : 0
}

export function tienePallets(televisiones: TelevisionRow[]) {
  return televisiones.some((tv) => tv.unidad === 'pallet')
}

export function diasHastaLimite(fechaLimite: string | null): number | null {
  if (!fechaLimite) return null
  const [y, m, d] = fechaLimite.split('-').map(Number)
  if (!y || !m || !d) return null
  const limite = new Date(y, m - 1, d)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function tiempoRestanteTexto(dias: number | null, t?: TFunc): { texto: string; clase: string } {
  if (dias === null) return { texto: t ? t('stats.sinFecha') : '—', clase: 'sin-fecha' }
  if (dias < 0) {
    const abs = Math.abs(dias)
    return { texto: t ? t('stats.vencido', { count: abs }) : `Vencido (${abs} ${abs === 1 ? 'día' : 'días'})`, clase: 'vencido' }
  }
  if (dias === 0) return { texto: t ? t('stats.hoy') : 'Hoy', clase: 'urgente' }
  if (dias === 1) return { texto: t ? t('stats.manana') : 'Mañana', clase: 'urgente' }
  if (dias <= 3) return { texto: t ? t('stats.dias', { count: dias }) : `${dias} días`, clase: 'urgente' }
  if (dias <= 7) return { texto: t ? t('stats.dias', { count: dias }) : `${dias} días`, clase: 'cercano' }
  return { texto: t ? t('stats.dias', { count: dias }) : `${dias} días`, clase: 'normal' }
}

export function formatearFechaLimite(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

export function formatearFechaHora(fecha: string | Date): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(f)
}

export function badgeProgreso(pct: number, t?: TFunc): { label: string; clase: string } {
  if (pct >= 100) return { label: t ? t('stats.completado') : 'Completado', clase: 'completo' }
  if (pct > 0) return { label: `${pct}%`, clase: 'parcial' }
  return { label: t ? t('stats.pendiente') : 'Pendiente', clase: 'pendiente' }
}
