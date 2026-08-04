// Clasificación visual de StatusName (SOP.vw_StatusInternal, WMS) en 7
// categorías — MISMA regla que LIVE_ORDER_BUCKET_CASE_SQL en
// server/services/binManagerSql.ts de Cubicaje, para que el conteo de las
// KPI cards nunca contradiga el badge que se muestra en la tabla. Por
// substring, no por catálogo cerrado: cualquier status no reconocido cae
// en 'nuevo' (nunca se pierde un pedido del conteo/badge).
export function bucketDeEstatus(estatus) {
  const e = (estatus || '').toLowerCase().trim()
  if (!e) return 'sinEstatus'
  if (e.includes('cancel')) return 'cancelado'
  if (e.includes('not stock') || e.includes('oversold') || e.includes('not found') || e.includes('unmapped')) {
    return 'incidencia'
  }
  if (e.includes('shipped') || e.includes('send -')) return 'enviado'
  if (e.includes('ready')) return 'listo'
  if (e.includes('multiple') || e.includes('assign') || e.includes('above')) return 'enProceso'
  if (e.includes('pending') || e.includes('pick')) return 'porSurtir'
  return 'nuevo'
}

// className del badge — clave usada como sufijo de .badge-estatus.<bucket>.
export function claseBadgeEstatus(estatus) {
  return bucketDeEstatus(estatus)
}
