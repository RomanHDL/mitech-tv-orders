// Búsqueda rápida de SKU dentro de un pedido (módulo Surtir). Reglas:
//  - Normaliza espacios y mayúsculas/minúsculas antes de comparar.
//  - Prioriza el SKU completo exacto; si hay coincidencia exacta, esa es la
//    única familia de resultados (nunca se mezcla con sufijos casuales de
//    otros SKU que también terminen igual).
//  - Si no hay coincidencia exacta, cae a coincidencia por sufijo (los
//    últimos caracteres capturados, p. ej. los últimos 4 dígitos).
// Puro y sin estado — igual patrón que lib/surtido-grupos.js — para poder
// probarlo sin React ni el DOM.

export function normalizeSkuQuery(raw) {
  return (raw || '').replace(/\s+/g, '').toUpperCase()
}

// `flatProducts` es el resultado de flattenGroupedProducts (lib/surtido-grupos.js):
// [{ product, group, brandLabel }], donde product.modelo es el SKU real.
export function searchSkuMatches(flatProducts, rawQuery) {
  const query = normalizeSkuQuery(rawQuery)
  if (!query) return []

  const exact = flatProducts.filter((item) => (item.product.modelo || '').toUpperCase() === query)
  if (exact.length > 0) return exact

  return flatProducts.filter((item) => (item.product.modelo || '').toUpperCase().endsWith(query))
}
