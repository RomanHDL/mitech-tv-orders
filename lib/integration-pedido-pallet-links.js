import { contieneClavesPeligrosas } from './integration-cubicaje'

// ─── Vinculación manual pedido ↔ pallet (Bloque 2) ─────────────────────
//
// Lógica pura, sin Mongo — el repositorio se recibe inyectado (ver
// lib/integration-pedido-pallet-links-db.js para la implementación real),
// igual que en el Bloque 1, para poder probar con fakes en memoria.
//
// No calcula "surtido efectivo" ni cambia cantidadSurtida — eso es un
// bloque posterior, aprobado por separado.

const MAX_PALLET_ID = 64
const MAX_MOTIVO = 500

export function validarVincularInput(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'El body debe ser un objeto JSON' }
  }
  if (contieneClavesPeligrosas(body)) {
    return { ok: false, status: 400, error: 'El payload contiene claves no permitidas' }
  }
  const { palletId } = body
  if (typeof palletId !== 'string' || !palletId.trim() || palletId.length > MAX_PALLET_ID) {
    return { ok: false, status: 422, error: 'palletId inválido' }
  }
  return { ok: true, value: { palletId: palletId.trim() } }
}

export function validarDesvincularInput(body) {
  if (body === undefined || body === null || body === '') {
    return { ok: true, value: { motivo: null } }
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'El body debe ser un objeto JSON' }
  }
  if (contieneClavesPeligrosas(body)) {
    return { ok: false, status: 400, error: 'El payload contiene claves no permitidas' }
  }
  const { motivo } = body
  if (motivo !== undefined && motivo !== null && (typeof motivo !== 'string' || motivo.length > MAX_MOTIVO)) {
    return { ok: false, status: 422, error: 'motivo inválido' }
  }
  return { ok: true, value: { motivo: motivo ? motivo.trim() : null } }
}

// ─── Normalización de SKU/condición ─────────────────────────────────────
//
// El pedido guarda `modelo` sin sufijo de condición (SKU_REGEX no permite
// guiones: /^[A-Za-z0-9]{3,20}$/), pero el SKU que reporta Cubicaje puede
// venir con la condición pegada como sufijo (ej. "SNTV007618-GRB"). Sin
// normalizar esto, comparar los dos formatos tal cual nunca coincide
// aunque sea exactamente el mismo artículo.

function normalizarTexto(valor) {
  return typeof valor === 'string' ? valor.trim().toUpperCase() : ''
}

export function normalizarCondicion(condicion) {
  return normalizarTexto(condicion)
}

export function normalizarSku(sku) {
  return normalizarTexto(sku)
}

// Quita el sufijo "-{condición}" del SKU del pallet SOLO si coincide
// exactamente con la condición informada — nunca un sufijo arbitrario.
//   normalizarSkuPallet('sntv007618-grb', 'grb') -> 'SNTV007618'
//   normalizarSkuPallet('ABC-123', 'GRB')        -> 'ABC-123'   (el sufijo real es "-123", no "-GRB")
//   normalizarSkuPallet('MODELO-GRB-X', 'GRB')   -> 'MODELO-GRB-X' (el sufijo real es "-X", no "-GRB")
//   normalizarSkuPallet('SNTV007618', '')        -> 'SNTV007618' (sin condición informada, no se toca)
export function normalizarSkuPallet(sku, condicion) {
  const skuNorm = normalizarSku(sku)
  const condNorm = normalizarCondicion(condicion)
  if (!condNorm) return skuNorm
  const sufijo = `-${condNorm}`
  if (skuNorm.length > sufijo.length && skuNorm.endsWith(sufijo)) {
    return skuNorm.slice(0, -sufijo.length)
  }
  return skuNorm
}

// Discrepancias BÁSICAS: solo señala productos del pallet cuyo SKU+condición
// (ya normalizados) no aparece en ninguna línea del pedido. No acumula
// cantidades, no calcula porcentaje ni "surtido efectivo" — eso es
// explícitamente de un bloque posterior. condicion de una línea de pedido
// puede venir en `condiciones` (array, formato actual) o `condicion`
// (string, formato legado) — misma normalización que ya usa el resto del
// código de pedidos.
export function detectarDiscrepanciasBasicas(pedido, productosPallet) {
  const lineasPedido = Array.isArray(pedido?.televisiones) ? pedido.televisiones : []
  const clavesPedido = new Set(
    lineasPedido.flatMap((tv) => {
      const condiciones = Array.isArray(tv.condiciones)
        ? tv.condiciones
        : (tv.condicion ? [tv.condicion] : [])
      const skuPedido = normalizarSku(tv.modelo)
      return condiciones.map((c) => `${skuPedido}::${normalizarCondicion(c)}`)
    })
  )

  return (Array.isArray(productosPallet) ? productosPallet : [])
    .map((p) => {
      const condicionNorm = normalizarCondicion(p.condicion)
      // Sin condición informada: no se puede evaluar la coincidencia — se
      // reporta explícitamente en vez de descartarlo en silencio.
      if (!condicionNorm) {
        return { sku: p.sku, condicion: p.condicion ?? null, cantidad: p.cantidad, motivo: 'sin_condicion' }
      }
      const skuNorm = normalizarSkuPallet(p.sku, condicionNorm)
      const clave = `${skuNorm}::${condicionNorm}`
      if (clavesPedido.has(clave)) return null
      return { sku: p.sku, condicion: p.condicion, cantidad: p.cantidad, motivo: 'no_solicitado' }
    })
    .filter(Boolean)
}

// Vincula un pallet a un pedido de forma idempotente:
//  - link activo existente al MISMO pedido -> no-op (ya_vinculado).
//  - link activo existente a OTRO pedido -> conflicto (409).
//  - sin link activo -> crea un documento NUEVO (nunca reescribe uno viejo,
//    así se conserva el historial de cada ciclo vincular/desvincular).
export async function vincularPallet(repo, { pedidoId, numeroPedidoSnapshot, palletId, usuario }, ahora = new Date()) {
  const existente = await repo.buscarActivoPorPalletId(palletId)
  if (existente) {
    if (existente.pedidoId === pedidoId) {
      return { status: 200, body: { status: 'ya_vinculado', link: existente } }
    }
    return {
      status: 409,
      body: { status: 'conflicto', error: 'El pallet ya está vinculado activamente a otro pedido' },
    }
  }

  const nuevoLink = {
    pedidoId,
    palletId,
    numeroPedidoSnapshot,
    activo: true,
    vinculadoPor: usuario?.userId || null,
    vinculadoPorNombre: usuario?.nombre || null,
    vinculadoEn: ahora,
    desvinculadoPor: null,
    desvinculadoPorNombre: null,
    desvinculadoEn: null,
    motivoDesvinculacion: null,
  }

  try {
    const creado = await repo.crear(nuevoLink)
    return { status: 201, body: { status: 'vinculado', link: creado } }
  } catch (err) {
    // Carrera: otro request vinculó este mismo palletId justo antes —
    // el índice único parcial (palletId, activo:true) es quien detecta esto.
    if (err?.code === 11000) {
      return {
        status: 409,
        body: { status: 'conflicto', error: 'El pallet ya está vinculado activamente a otro pedido' },
      }
    }
    throw err
  }
}

// Desvincular es idempotente: si ya no hay link activo para ese pedido
// (nunca existió, o ya se había desvinculado antes), responde 200
// "ya_desvinculado" en vez de error — una segunda desvinculación no debe
// fallar.
export async function desvincularPallet(repo, { pedidoId, palletId, motivo, usuario }, ahora = new Date()) {
  const activo = await repo.buscarActivoPorPalletId(palletId)
  if (!activo || activo.pedidoId !== pedidoId) {
    return { status: 200, body: { status: 'ya_desvinculado' } }
  }
  const actualizado = await repo.desactivar(activo._id, {
    desvinculadoPor: usuario?.userId || null,
    desvinculadoPorNombre: usuario?.nombre || null,
    desvinculadoEn: ahora,
    motivoDesvinculacion: motivo || null,
  })
  return { status: 200, body: { status: 'desvinculado', link: actualizado } }
}
