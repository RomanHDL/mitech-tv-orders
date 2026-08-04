// Cliente server-only hacia el puente de solo lectura de Cubicaje
// (GET /api/integrations/live-orders). Este proyecto ya NO habla con
// BinManagerRO ni con la API de pallets del WMS directamente — Cubicaje es
// el único que consulta sistemas empresariales, ver CUBICAJE_INTEGRATION_KEY
// más abajo. Nunca importar este archivo desde un Client Component: la
// llave viaja en un header de servidor a servidor, jamás al navegador.

const DEFAULT_TIMEOUT_MS = 10000

function baseUrl() {
  const url = process.env.CUBICAJE_API_URL
  if (!url) throw new Error('CUBICAJE_API_URL no está configurada')
  return url.replace(/\/+$/, '')
}

function integrationKey() {
  const key = process.env.CUBICAJE_INTEGRATION_KEY
  if (!key) throw new Error('CUBICAJE_INTEGRATION_KEY no está configurada')
  return key
}

async function callCubicaje(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${baseUrl()}${path}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  let res
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${integrationKey()}` },
      cache: 'no-store',
      signal: ctrl.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Tiempo de espera agotado al consultar Cubicaje')
      e.status = 504
      throw e
    }
    const e = new Error('No se pudo conectar con Cubicaje')
    e.status = 502
    throw e
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Cubicaje respondió ${res.status}`)
    e.status = res.status
    throw e
  }
  return data
}

// GET /integrations/live-orders — listado paginado de pedidos en vivo.
export async function fetchLiveOrders({
  page, limit, search, orderNumber, palletId, estado, fecha, marketplace, cuenta, ubicacion,
} = {}) {
  const qs = new URLSearchParams()
  if (page) qs.set('page', String(page))
  if (limit) qs.set('limit', String(limit))
  if (search) qs.set('search', search)
  if (orderNumber) qs.set('orderNumber', orderNumber)
  if (palletId) qs.set('palletId', palletId)
  if (estado) qs.set('estado', estado)
  if (fecha) qs.set('fecha', fecha)
  if (marketplace) qs.set('marketplace', marketplace)
  if (cuenta) qs.set('cuenta', cuenta)
  if (ubicacion) qs.set('ubicacion', ubicacion)

  return callCubicaje(`/api/integrations/live-orders?${qs.toString()}`)
}

// GET /integrations/live-orders/:orderId/items — artículos + pallets +
// granel para el detalle de un pedido.
export async function fetchLiveOrderItems(orderId) {
  return callCubicaje(`/api/integrations/live-orders/${encodeURIComponent(orderId)}/items`)
}

// GET /integrations/live-orders/stats — KPIs reales sobre todo el dataset.
export async function fetchLiveOrdersStats() {
  return callCubicaje('/api/integrations/live-orders/stats')
}

// GET /integrations/live-orders/filters — opciones reales para los selects.
export async function fetchLiveOrdersFilters() {
  return callCubicaje('/api/integrations/live-orders/filters')
}
