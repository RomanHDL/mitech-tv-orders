import { normalizarCondicion, normalizarSku, normalizarSkuPallet } from './integration-pedido-pallet-links'
import { calcularTotales } from './estado-pedido'

// ─── Progreso sincronizado de un pedido (Bloque 3) ──────────────────────
//
// Lógica pura, sin Mongo — cruza televisiones[] del pedido contra los
// pallets de sus vínculos ACTIVOS (Cubicaje), sin tocar cantidadSurtida ni
// ningún otro campo persistido. Reutiliza calcularTotales() de
// lib/estado-pedido.js para cantidadSolicitada/cantidadSurtidaManual —
// así estos dos números son EXACTAMENTE los mismos que ya muestran la
// lista y el detalle del pedido, sin duplicar esa lógica ni arriesgar que
// se desincronicen.
//
// Regla de "surtido efectivo" (aprobada): max(manual, sincronizadaValida)
// POR LÍNEA, nunca sumados — se aplica línea por línea y el total del
// resumen es la SUMA de esos máximos por línea (igual que totalSurtido de
// calcularTotales es una suma por línea, no un máximo global). Aplicar el
// máximo a nivel global en vez de por línea daría un número distinto y
// menos preciso cuando el manual y el sincronizado no coinciden en la
// misma línea — ver pruebas "surtido manual mayor" / "sincronizado mayor".

function condicionesDeLinea(tv) {
  return Array.isArray(tv.condiciones) ? tv.condiciones : (tv.condicion ? [tv.condicion] : [])
}

function clave(skuNorm, condNorm) {
  return `${skuNorm}::${condNorm}`
}

function redondear2(n) {
  return Math.round(n * 100) / 100
}

// `vinculos`: array de { link, pallet } — `link` es el documento crudo de
// integrationPedidoPalletLinks (se revalida activo:true aquí como defensa
// adicional, aunque el caller ya debería haber filtrado por activos);
// `pallet` es el documento de integrationCubicajePallets correspondiente,
// o null si el pallet ya no existe.
export function calcularProgresoPedido(pedido, vinculos) {
  const tvs = Array.isArray(pedido?.televisiones) ? pedido.televisiones : []
  const { totalRequerido: cantidadSolicitada, totalSurtido: cantidadSurtidaManual } = calcularTotales(pedido)

  const advertencias = []
  const discrepancias = []

  // ── 1) Filtra vínculos participantes y construye el pool de unidades ──
  // Solo cuentan: link activo:true, pallet existente, pallet activo:true.
  const palletsVistos = new Set()
  const pool = new Map() // clave normalizada -> cantidad disponible
  const skuOriginalPorClave = new Map() // clave -> sku tal como llegó (para reportar discrepancias legibles)
  let palletsParticipantes = 0

  for (const vinculo of Array.isArray(vinculos) ? vinculos : []) {
    const link = vinculo?.link
    const pallet = vinculo?.pallet

    if (!link || link.activo === false) {
      advertencias.push({ tipo: 'link_inactivo', palletId: link?.palletId ?? null })
      continue
    }
    if (!pallet) {
      advertencias.push({ tipo: 'pallet_no_encontrado', palletId: link.palletId })
      continue
    }
    if (pallet.activo === false) {
      advertencias.push({ tipo: 'pallet_inactivo', palletId: link.palletId })
      continue
    }
    // Duplicado defensivo (el mismo palletId dos veces en la entrada): se
    // cuenta una sola vez, nunca duplica piezas.
    if (palletsVistos.has(pallet.palletId)) continue
    palletsVistos.add(pallet.palletId)
    palletsParticipantes += 1

    for (const p of Array.isArray(pallet.productos) ? pallet.productos : []) {
      const condNorm = normalizarCondicion(p.condicion)
      if (!condNorm) {
        discrepancias.push({ sku: p.sku ?? null, condicion: p.condicion ?? null, cantidad: p.cantidad ?? null, motivo: 'sin_condicion' })
        continue
      }
      if (!Number.isFinite(p.cantidad) || p.cantidad <= 0) {
        advertencias.push({ tipo: 'cantidad_invalida', palletId: pallet.palletId, sku: p.sku ?? null })
        continue
      }
      const skuNorm = normalizarSkuPallet(p.sku, condNorm)
      const c = clave(skuNorm, condNorm)
      pool.set(c, (pool.get(c) || 0) + p.cantidad)
      if (!skuOriginalPorClave.has(c)) skuOriginalPorClave.set(c, p.sku)
    }
  }

  // ── 2) Distribución determinista: recorre las líneas en su orden original ──
  // Cada unidad del pool se consume a lo sumo una vez — nunca se cuenta la
  // misma pieza en dos líneas.
  const clavesConocidas = new Set()
  const lineas = tvs.map((tv, indice) => {
    const condiciones = condicionesDeLinea(tv)
    const skuNormLinea = normalizarSku(tv.modelo)
    const sinLimite = !!tv.sinLimite
    // Línea "sin límite": mismo criterio que calcularTotales() — no aporta
    // a cantidadSolicitada (cantidad guardada es 0 por convención) y su
    // pendiente no aplica (null), igual que ya hace pedido-detalle-modal.
    const solicitada = sinLimite ? null : (tv.cantidad || 0)
    const manual = tv.cantidadSurtida || 0

    let restante = sinLimite ? Infinity : solicitada
    let sincronizada = 0
    for (const cond of condiciones) {
      const condNorm = normalizarCondicion(cond)
      const c = clave(skuNormLinea, condNorm)
      clavesConocidas.add(c)
      if (restante <= 0) continue
      const disponible = pool.get(c) || 0
      const tomar = Math.min(disponible, restante)
      if (tomar > 0) {
        sincronizada += tomar
        pool.set(c, disponible - tomar)
        if (!sinLimite) restante -= tomar
      }
    }

    const surtidoEfectivo = Math.max(manual, sincronizada)
    const pendiente = sinLimite ? null : Math.max(0, solicitada - surtidoEfectivo)

    return {
      indice,
      modelo: tv.modelo,
      condiciones,
      cantidadSolicitada: solicitada,
      cantidadSurtidaManual: manual,
      cantidadSincronizada: sincronizada,
      cantidadSincronizadaValida: sincronizada,
      surtidoEfectivo,
      cantidadPendiente: pendiente,
    }
  })

  // ── 3) Lo que sobra en el pool tras procesar todas las líneas ──
  // Si la clave correspondía a alguna línea (solicitada) pero sobró
  // cantidad → excedente. Si la clave nunca correspondió a ninguna línea →
  // no solicitado en absoluto.
  let excedenteTotal = 0
  for (const [c, cantidad] of pool.entries()) {
    if (cantidad <= 0) continue
    const [skuClave, condicionClave] = c.split('::')
    const sku = skuOriginalPorClave.get(c) || skuClave
    if (clavesConocidas.has(c)) {
      discrepancias.push({ sku, condicion: condicionClave, cantidad, motivo: 'cantidad_excedente' })
      excedenteTotal += cantidad
    } else {
      discrepancias.push({ sku, condicion: condicionClave, cantidad, motivo: 'no_solicitado' })
    }
  }

  const cantidadSincronizadaValida = lineas.reduce((s, l) => s + l.cantidadSincronizadaValida, 0)
  const cantidadSincronizada = cantidadSincronizadaValida + excedenteTotal
  const surtidoEfectivoTotal = lineas.reduce((s, l) => s + l.surtidoEfectivo, 0)
  const cantidadConDiscrepancia = discrepancias.reduce((s, d) => s + (d.cantidad || 0), 0)
  const cantidadPendiente = Math.max(0, cantidadSolicitada - surtidoEfectivoTotal)

  const pct = (num) => (cantidadSolicitada > 0 ? redondear2((num / cantidadSolicitada) * 100) : 0)

  return {
    resumen: {
      cantidadSolicitada,
      cantidadSurtidaManual,
      cantidadSincronizada,
      cantidadSincronizadaValida,
      cantidadConDiscrepancia,
      surtidoEfectivo: surtidoEfectivoTotal,
      cantidadPendiente,
      porcentajeManual: pct(cantidadSurtidaManual),
      porcentajeSincronizado: pct(cantidadSincronizadaValida),
      porcentajeEfectivo: pct(surtidoEfectivoTotal),
      palletsVinculados: palletsParticipantes,
    },
    lineas,
    discrepancias,
    advertencias,
  }
}
