import { ESTADO_LABEL, ESTADO_ORDEN } from './catalogos'

// ─── Ciclo de vida operativo de un pedido ────────────────────────────
//
// Un solo lugar decide el estado final que se muestra en TODA la app
// (tabla, historial, surtir, detalle, stepper, Excel). Antes esta lógica
// estaba duplicada 3-4 veces por archivo (badgeProgreso/badgeEstado/
// estadoCard) y cada copia solo sabía derivar del progreso de surtido.
// Ahora:
//   - PENDIENTE / EN_PROCESO / TERMINADO se derivan siempre del progreso
//     (cantidadSurtida vs cantidad), igual que antes.
//   - CARGANDO / LISTO_SALIDA / DESPACHADO / CANCELADO solo existen si un
//     admin o surtidor los fijó explícitamente (pedido.estadoOperativo).
//   - Un estado avanzado nunca retrocede: si ya está CARGANDO y el pedido
//     sigue en 100%, se queda en CARGANDO, no "regresa" a TERMINADO.

// fechaLimite viene como 'YYYY-MM-DD'. Días hasta hoy (0 = hoy, negativo = vencido).
export function diasHastaLimite(fechaLimite) {
  if (!fechaLimite) return null
  const [y, m, d] = fechaLimite.split('-').map(Number)
  if (!y || !m || !d) return null
  const limite = new Date(y, m - 1, d)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = limite.getTime() - hoy.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

// Estado derivado únicamente del progreso de surtido (0/parcial/100%).
function estadoDerivadoDeProgreso(progresoPct) {
  if (progresoPct >= 100) return 'TERMINADO'
  if (progresoPct > 0) return 'EN_PROCESO'
  return 'PENDIENTE'
}

// Fuente única de verdad del estado operativo final de un pedido.
// Acepta cualquier objeto con { progresoPct, estadoOperativo }.
export function normalizeOrderStatus(pedido) {
  const stored = pedido?.estadoOperativo || null
  if (stored === 'CANCELADO') return 'CANCELADO'

  const computed = estadoDerivadoDeProgreso(pedido?.progresoPct || 0)
  if (stored && ESTADO_ORDEN[stored] !== undefined && ESTADO_ORDEN[stored] > ESTADO_ORDEN[computed]) {
    return stored
  }
  return computed
}

export function estadoLabel(estado) {
  return ESTADO_LABEL[estado] || estado
}

// Clase CSS por estado — usada tanto en el badge de estado como en el stepper.
export function estadoClase(estado) {
  switch (estado) {
    case 'PENDIENTE': return 'pendiente'
    case 'EN_PROCESO': return 'en-proceso'
    case 'TERMINADO': return 'terminado'
    case 'CARGANDO': return 'cargando'
    case 'LISTO_SALIDA': return 'listo-salida'
    case 'DESPACHADO': return 'despachado'
    case 'CANCELADO': return 'cancelado'
    default: return 'pendiente'
  }
}

// "Cumplimiento" (antes "Tiempo restante") — reemplaza a tiempoRestanteTexto,
// que estaba duplicado en 3 archivos y solo miraba la fecha, nunca el estado.
// Prioridad exacta pedida: estados finales primero, "Vencido" solo si el
// pedido sigue activo, tiene pendientes y la fecha ya pasó.
export function cumplimientoTexto(pedido) {
  const estado = normalizeOrderStatus(pedido)

  if (estado === 'DESPACHADO') return { texto: 'Despachado', clase: 'despachado' }
  if (estado === 'LISTO_SALIDA') return { texto: 'Listo para salida', clase: 'listo-salida' }
  if (estado === 'CARGANDO') return { texto: 'Cargando', clase: 'cargando' }
  if (estado === 'TERMINADO') return { texto: 'Surtido terminado', clase: 'terminado' }
  if (estado === 'CANCELADO') return { texto: 'Cancelado', clase: 'cancelado' }

  // Solo llega aquí PENDIENTE/EN_PROCESO (activo).
  const pendiente = pedido?.pendiente ?? 0
  const dias = diasHastaLimite(pedido?.fechaLimite)

  if (dias === null) return { texto: '—', clase: 'sin-fecha' }
  if (dias < 0 && pendiente > 0) {
    const abs = Math.abs(dias)
    return { texto: `Vencido (${abs} ${abs === 1 ? 'día' : 'días'})`, clase: 'vencido' }
  }
  if (dias < 0) return { texto: '—', clase: 'sin-fecha' } // vencido pero sin pendientes (raro, no debería pasar)
  if (dias === 0) return { texto: 'Hoy', clase: 'urgente' }
  if (dias === 1) return { texto: 'Mañana', clase: 'urgente' }
  if (dias <= 3) return { texto: `${dias} días`, clase: 'urgente' }
  if (dias <= 7) return { texto: `${dias} días`, clase: 'cercano' }
  return { texto: `${dias} días`, clase: 'normal' }
}

// Filtro calculado "Vencidos" (no es un estado almacenado): activo, con
// pendientes y fecha límite ya pasada.
export function estaVencido(pedido) {
  const estado = normalizeOrderStatus(pedido)
  if (estado !== 'PENDIENTE' && estado !== 'EN_PROCESO') return false
  const pendiente = pedido?.pendiente ?? 0
  if (pendiente <= 0) return false
  const dias = diasHastaLimite(pedido?.fechaLimite)
  return dias !== null && dias < 0
}

// Cálculo de totales a partir del documento crudo de Mongo (televisiones[] +
// cantidadTotal). Única fuente de verdad para totalRequerido/totalSurtido/
// pendiente/progresoPct — antes se recalculaba a mano en cada page.jsx
// (pedidos/surtir/historial), con riesgo de que alguna copia se desincronice.
export function calcularTotales(pedido) {
  const tvs = pedido?.televisiones || []
  const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
  const totalRequerido =
    typeof pedido?.cantidadTotal === 'number' && pedido.cantidadTotal > 0
      ? pedido.cantidadTotal
      : sumaCantidades
  // Surtido cuenta lo que se haya marcado, acotado a la cantidad del TV
  // cuando esta definida; las TVs "sin límite" cuentan tal cual.
  const totalSurtido = tvs.reduce((s, tv) => {
    const surt = tv.cantidadSurtida || 0
    if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
    return s + Math.min(tv.cantidad || 0, surt)
  }, 0)
  const progresoPct = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
  const pendiente = Math.max(0, totalRequerido - totalSurtido)
  return { totalRequerido, totalSurtido, progresoPct, pendiente }
}

// Etapas para el stepper logístico (orden fijo, siempre las 6 — CANCELADO
// se muestra aparte, no como una etapa más de la línea).
export const ETAPAS = [
  { clave: 'PENDIENTE', label: 'Pendiente' },
  { clave: 'EN_PROCESO', label: 'En proceso' },
  { clave: 'TERMINADO', label: 'Surtido terminado' },
  { clave: 'CARGANDO', label: 'Cargando' },
  { clave: 'LISTO_SALIDA', label: 'Listo para salida' },
  { clave: 'DESPACHADO', label: 'Despachado' },
]
