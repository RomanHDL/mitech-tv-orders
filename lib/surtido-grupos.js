// Agrupación y metas del módulo Surtir — dos niveles (marca → pulgadas).
//
// La meta pertenece al GRUPO (marca+pulgadas), no a cada SKU individual:
// varios SKU pueden aportar cualquier cantidad hasta completar la meta
// conjunta del grupo — nunca se reparte automáticamente entre ellos (ver
// mockup_surtido_agrupado_corregido.html, referencia visual/funcional).
//
// Flujo siempre derivado, nunca destructivo:
//   televisiones → groupProductsByBrandAndSize → calculateGroupSummary
// Cada producto conserva `_idx` (su posición real en el arreglo original
// `televisiones`, NO la posición renderizada) para que las acciones de
// Surtir (+/-/confirmar/reiniciar) sigan apuntando al TV correcto sin
// importar cómo se reordenó visualmente.

export const GROUP_STATUS = {
  UNDEFINED: 'POR_DEFINIR',
  NOT_STARTED: 'SIN_INICIAR',
  IN_PROGRESS: 'EN_PROCESO',
  COMPLETE: 'COMPLETO',
  EXCEEDED: 'EXCEDIDO',
}

export function normalizeBrand(marca) {
  return (marca || '').trim().toUpperCase()
}

// Usa el campo real de pulgadas; nunca extrae un número de una descripción
// libre cuando ya existe este campo confiable.
export function normalizeSize(tv) {
  const n = Number(tv?.pulgadas)
  return Number.isFinite(n) ? n : 0
}

export function createGroupKey(marca, pulgadas) {
  return `${normalizeBrand(marca)}-${Number(pulgadas) || 0}`
}

// requested === 0 (meta real de cero) es distinto de null/undefined/'' (meta
// todavía por definir) — nunca usar `if (!requested)`, confundiría ambos casos.
export function isRequestedQuantityDefined(requested) {
  return requested !== null && requested !== undefined && requested !== ''
}

function suppliedOf(products) {
  return products.reduce((sum, p) => sum + (Number(p.cantidadSurtida) || 0), 0)
}

// Meta real del grupo:
//  1) Si el pedido define explícitamente esta clave en metasGrupo (incluido
//     `null` = "por definir a propósito"), esa es la fuente de verdad.
//  2) Si no, se preserva el comportamiento histórico para pedidos que no usan
//     metas de grupo: la suma de las cantidades individuales ya capturadas
//     por SKU — salvo que algún miembro sea "sin límite" (ahí no existe un
//     techo real que sumar, así que el grupo completo queda "por definir").
export function resolveGroupRequested(groupKey, products, metasGrupo) {
  if (metasGrupo && Object.prototype.hasOwnProperty.call(metasGrupo, groupKey)) {
    const meta = metasGrupo[groupKey]
    return isRequestedQuantityDefined(meta) ? Number(meta) : null
  }
  if (products.some((p) => p.sinLimite)) return null
  return products.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0)
}

// Regla general (no hardcodeada a ningún grupo específico): si el grupo
// tiene exactamente un SKU y su meta está definida, esa meta es también la
// meta individual de ese único SKU.
export function getIndividualSkuTarget(group) {
  const hasIndividualTarget = group.products.length === 1 && isRequestedQuantityDefined(group.requested)
  return hasIndividualTarget ? group.requested : null
}

export function getGroupStatus(requested, supplied) {
  if (!isRequestedQuantityDefined(requested)) return GROUP_STATUS.UNDEFINED
  if (supplied > requested) return GROUP_STATUS.EXCEEDED
  if (supplied === requested) return GROUP_STATUS.COMPLETE
  if (supplied > 0) return GROUP_STATUS.IN_PROGRESS
  return GROUP_STATUS.NOT_STARTED
}

// Etiqueta traducida de un estado de grupo — mismo patrón que
// estadoLabel/unidadLabel en catalogos.js (t viene del hook useTranslation
// en cliente). EXCEEDED necesita el excedente para el texto "Excedido +N".
export function groupStatusLabel(t, status, excess = 0) {
  switch (status) {
    case GROUP_STATUS.NOT_STARTED: return t('surtir.grupo.estadoSinIniciar')
    case GROUP_STATUS.IN_PROGRESS: return t('surtir.grupo.estadoEnProceso')
    case GROUP_STATUS.COMPLETE: return t('surtir.grupo.estadoCompleto')
    case GROUP_STATUS.EXCEEDED: return t('surtir.grupo.estadoExcedido', { n: excess })
    default: return t('surtir.grupo.estadoPorDefinir')
  }
}

export function calculateGroupSummary(group) {
  const supplied = suppliedOf(group.products)
  const { requested } = group
  const defined = isRequestedQuantityDefined(requested)
  const pending = defined ? Math.max(requested - supplied, 0) : null
  const excess = defined ? Math.max(supplied - requested, 0) : 0
  const status = getGroupStatus(requested, supplied)
  const individualTarget = getIndividualSkuTarget(group)
  return { supplied, requested, pending, excess, status, individualTarget }
}

// televisiones → normalize → groupByBrand → groupBySize. Nunca muta el
// arreglo recibido. Orden: marca según su primera aparición en el pedido;
// pulgadas ascendente dentro de cada marca; SKUs en su orden original de
// inserción dentro de cada grupo (sin sort — ni alfabético, ni por
// cantidad, ni por SKU).
export function groupProductsByBrandAndSize(televisiones, metasGrupo) {
  const brandOrder = []
  const brandMap = new Map()

  televisiones.forEach((tv, idx) => {
    const brandKey = normalizeBrand(tv.marca)
    if (!brandMap.has(brandKey)) {
      brandMap.set(brandKey, { label: tv.marca || brandKey, sizeMap: new Map(), sizeOrder: [] })
      brandOrder.push(brandKey)
    }
    const brand = brandMap.get(brandKey)
    const size = normalizeSize(tv)
    if (!brand.sizeMap.has(size)) {
      brand.sizeMap.set(size, [])
      brand.sizeOrder.push(size)
    }
    brand.sizeMap.get(size).push({ ...tv, _idx: idx })
  })

  return brandOrder.map((brandKey) => {
    const brand = brandMap.get(brandKey)
    const sizes = [...brand.sizeOrder]
      .sort((a, b) => a - b)
      .map((size) => {
        const products = brand.sizeMap.get(size)
        const key = createGroupKey(brand.label, size)
        const requested = resolveGroupRequested(key, products, metasGrupo)
        const group = { key, brand: brand.label, size, products, requested }
        return { ...group, summary: calculateGroupSummary(group) }
      })
    return { key: brandKey, label: brand.label, sizes }
  })
}

export function calculateBrandSummary(brandSection) {
  const skuCount = brandSection.sizes.reduce((s, g) => s + g.products.length, 0)
  const requestedDefinedTotal = brandSection.sizes.reduce(
    (s, g) => s + (isRequestedQuantityDefined(g.requested) ? g.requested : 0),
    0,
  )
  const suppliedTotal = brandSection.sizes.reduce((s, g) => s + g.summary.supplied, 0)
  const pendingTotal = brandSection.sizes.reduce((s, g) => s + (g.summary.pending ?? 0), 0)
  const undefinedGroupsCount = brandSection.sizes.filter((g) => !isRequestedQuantityDefined(g.requested)).length
  return { skuCount, requestedDefinedTotal, suppliedTotal, pendingTotal, undefinedGroupsCount }
}

// Pendiente general = suma del pendiente de cada grupo CON meta definida —
// nunca "total del pedido menos suma absoluta de todos los SKU", porque un
// grupo por definir (ej. Samsung 85") puede tener piezas surtidas sin meta,
// y eso alteraría incorrectamente el pendiente de los grupos sí definidos.
// Al guardar (crear/editar), descarta cualquier entrada de metasGrupo cuya
// clave ya no corresponde a ningún SKU actual — evita metas huérfanas en lo
// que se envía al servidor cuando un grupo se queda sin productos (ej. se
// cambió la marca/pulgadas del único SKU que tenía, o se eliminó).
export function filtrarMetasHuerfanas(metasGrupo, televisiones) {
  if (!metasGrupo) return {}
  const clavesVivas = new Set(televisiones.map((tv) => createGroupKey(tv.marca, tv.pulgadas)))
  return Object.fromEntries(Object.entries(metasGrupo).filter(([key]) => clavesVivas.has(key)))
}

// Aplana la agrupación a una lista de productos con el contexto de su grupo
// (marca, grupo con su resumen/meta) — usado por el buscador rápido de SKU
// en Surtir, que necesita la meta y el resumen del GRUPO al que pertenece
// cada SKU, no solo el TV suelto. Conserva `product._idx`, el mismo índice
// real dentro de `tvs` que ya usan las acciones +/-/confirmar/reiniciar.
export function flattenGroupedProducts(brandSections) {
  return brandSections.flatMap((brand) =>
    brand.sizes.flatMap((group) =>
      group.products.map((product) => ({ product, group, brandLabel: brand.label })),
    ),
  )
}

export function calculateOrderSummary(brandSections) {
  const allGroups = brandSections.flatMap((b) => b.sizes)
  const totalRequestedDefined = allGroups.reduce(
    (s, g) => s + (isRequestedQuantityDefined(g.requested) ? g.requested : 0),
    0,
  )
  const totalSuppliedDefined = allGroups.reduce(
    (s, g) => s + (isRequestedQuantityDefined(g.requested) ? g.summary.supplied : 0),
    0,
  )
  const totalSuppliedUndefined = allGroups.reduce(
    (s, g) => s + (!isRequestedQuantityDefined(g.requested) ? g.summary.supplied : 0),
    0,
  )
  const totalPending = allGroups.reduce((s, g) => s + (g.summary.pending ?? 0), 0)
  const completeCount = allGroups.filter((g) => g.summary.status === GROUP_STATUS.COMPLETE).length
  const inProgressCount = allGroups.filter((g) => g.summary.status === GROUP_STATUS.IN_PROGRESS).length
  const exceededCount = allGroups.filter((g) => g.summary.status === GROUP_STATUS.EXCEEDED).length
  const undefinedCount = allGroups.filter((g) => g.summary.status === GROUP_STATUS.UNDEFINED).length
  return {
    totalRequestedDefined,
    totalSupplied: totalSuppliedDefined + totalSuppliedUndefined,
    totalSuppliedDefined,
    totalSuppliedUndefined,
    totalPending,
    completeCount,
    inProgressCount,
    exceededCount,
    undefinedCount,
  }
}
