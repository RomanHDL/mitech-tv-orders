import crypto from 'node:crypto'

// ─── Integración Cubicaje → Pedidos (M2M) ──────────────────────────────
//
// Lógica pura de validación e idempotencia del endpoint receptor de
// pallets. Deliberadamente NO importa Mongo aquí — el repositorio de
// pallets/eventos/syncStatus se recibe inyectado (ver lib/integration-
// cubicaje-db.js para la implementación real), así esta lógica se puede
// probar con fakes en memoria sin tocar la base de datos real.

export const PAYLOAD_VERSION_SOPORTADA = 1
export const MAX_PRODUCTOS_POR_PALLET = 200
const MAX_STRING_CORTA = 64
const MAX_STRING_LARGA = 128
const MAX_CONDICION = 16

// Compara dos secretos en tiempo constante. Hashea ambos a longitud fija
// (32 bytes) antes de comparar para que ni siquiera una diferencia de
// longitud del string original sea observable por timing.
export function compararSecretoEnTiempoConstante(recibido, esperado) {
  if (typeof recibido !== 'string' || !recibido) return false
  if (typeof esperado !== 'string' || !esperado) return false
  const hashRecibido = crypto.createHash('sha256').update(recibido).digest()
  const hashEsperado = crypto.createHash('sha256').update(esperado).digest()
  return crypto.timingSafeEqual(hashRecibido, hashEsperado)
}

// Protección contra inyección de operadores Mongo / prototype pollution:
// ningún objeto anidado del body puede tener una clave que empiece con
// "$", contenga "." o sea __proto__/constructor/prototype.
export function contieneClavesPeligrosas(valor) {
  if (Array.isArray(valor)) return valor.some(contieneClavesPeligrosas)
  if (valor && typeof valor === 'object') {
    for (const clave of Object.keys(valor)) {
      if (clave.startsWith('$') || clave.includes('.')) return true
      if (clave === '__proto__' || clave === 'constructor' || clave === 'prototype') return true
      if (contieneClavesPeligrosas(valor[clave])) return true
    }
  }
  return false
}

function esStringValida(valor, maxLen) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.length <= maxLen
}

function esStringOpcionalValida(valor, maxLen) {
  return valor === undefined || valor === null || esStringValida(valor, maxLen)
}

function esEnteroOpcionalValido(valor) {
  return valor === undefined || valor === null || Number.isInteger(valor)
}

// ─── Validación estricta de lastSync (ISO-8601 completo) ───────────────
//
// `new Date(str)` a secas es demasiado permisivo: acepta "July 29, 2026",
// "2026/07/29", etc., y además NORMALIZA fechas imposibles en silencio
// (ej. new Date('2026-02-30') no truena, rueda hacia adelante a marzo).
// Por eso validamos el formato con regex Y el rango de cada componente
// a mano (incluyendo días-por-mes con año bisiesto) antes de confiar en
// el parseo nativo.
const ISO_8601_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

function diasEnMes(anio, mes) {
  const dias = [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return dias[mes - 1]
}

export function esFechaIso8601Valida(valor) {
  if (typeof valor !== 'string' || !valor) return false
  const match = ISO_8601_REGEX.exec(valor)
  if (!match) return false

  const anio = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])
  const hora = Number(match[4])
  const minuto = Number(match[5])
  const segundo = Number(match[6])

  if (mes < 1 || mes > 12) return false
  if (dia < 1 || dia > diasEnMes(anio, mes)) return false
  if (hora > 23) return false
  if (minuto > 59) return false
  if (segundo > 59) return false

  // Con formato y rangos ya verificados a mano, esta última comprobación
  // es solo una red de seguridad adicional (nunca debería fallar aquí).
  const parsed = new Date(valor)
  return !Number.isNaN(parsed.getTime())
}

// Normaliza un lastSync ya validado a su representación UTC consistente
// (siempre terminado en "Z", milisegundos explícitos) antes de guardarlo,
// para que todas las comparaciones futuras partan de la misma forma
// canónica sin importar el offset original con el que llegó.
export function normalizarLastSync(valorValidado) {
  return new Date(new Date(valorValidado).toISOString())
}

// Quita cualquier cadena de conexión de Mongo (con o sin credenciales)
// de un mensaje de error antes de loguearlo — nunca deben aparecer en
// logs ni en respuestas al cliente.
const PATRON_URI_MONGO = /mongodb(?:\+srv)?:\/\/[^\s"')]+/gi

export function sanitizarMensajeError(err) {
  const mensaje = err && err.message ? String(err.message) : String(err)
  return mensaje.replace(PATRON_URI_MONGO, 'mongodb://[redactado]')
}

// Valida el body recibido y, si es válido, devuelve una versión normalizada
// (con los tipos correctos y los opcionales explícitos como null).
export function validarPayloadPallet(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'El body debe ser un objeto JSON' }
  }

  if (contieneClavesPeligrosas(body)) {
    return { ok: false, status: 400, error: 'El payload contiene claves no permitidas' }
  }

  const {
    eventId, payloadVersion, palletId, cantidadTotal, productos,
    ubicacion, workcenter, operador, workOrderId, sourceOrderId,
    woType, purchaseId, activo, lastSync,
  } = body

  const errores = []

  if (!esStringValida(eventId, MAX_STRING_LARGA)) errores.push('eventId inválido')
  if (payloadVersion !== PAYLOAD_VERSION_SOPORTADA) {
    errores.push(`payloadVersion no soportado (se esperaba ${PAYLOAD_VERSION_SOPORTADA})`)
  }
  if (!esStringValida(palletId, MAX_STRING_CORTA)) errores.push('palletId inválido')
  if (!Number.isFinite(cantidadTotal) || cantidadTotal < 0) errores.push('cantidadTotal inválida')

  // Si algún producto es inválido, `errores` termina no-vacío y se rechaza
  // el payload completo más abajo — por eso normalizar aquí sin filtrar
  // es seguro: productosNormalizados solo se usa en la rama ok:true.
  let productosNormalizados = []
  if (!Array.isArray(productos) || productos.length < 1) {
    errores.push('productos debe ser un arreglo con al menos 1 elemento')
  } else if (productos.length > MAX_PRODUCTOS_POR_PALLET) {
    errores.push(`productos excede el máximo permitido (${MAX_PRODUCTOS_POR_PALLET})`)
  } else {
    productos.forEach((p, i) => {
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        errores.push(`productos[${i}] inválido`)
        return
      }
      if (!esStringValida(p.sku, MAX_STRING_CORTA)) errores.push(`productos[${i}].sku inválido`)
      if (!esStringValida(p.condicion, MAX_CONDICION)) errores.push(`productos[${i}].condicion inválida`)
      if (!Number.isInteger(p.cantidad) || p.cantidad <= 0) errores.push(`productos[${i}].cantidad inválida`)
      if (!esStringOpcionalValida(p.numeroSerie, MAX_STRING_CORTA)) errores.push(`productos[${i}].numeroSerie inválido`)
      productosNormalizados.push({
        sku: p.sku,
        condicion: p.condicion,
        cantidad: p.cantidad,
        numeroSerie: p.numeroSerie ?? null,
      })
    })
  }

  if (!esStringOpcionalValida(ubicacion, MAX_STRING_LARGA)) errores.push('ubicacion inválida')
  if (!esStringOpcionalValida(workcenter, MAX_STRING_LARGA)) errores.push('workcenter inválido')
  if (!esStringOpcionalValida(operador, MAX_STRING_LARGA)) errores.push('operador inválido')
  if (!esStringOpcionalValida(sourceOrderId, MAX_STRING_LARGA)) errores.push('sourceOrderId inválido')
  if (!esStringOpcionalValida(woType, MAX_STRING_CORTA)) errores.push('woType inválido')
  if (!esEnteroOpcionalValido(workOrderId)) errores.push('workOrderId inválido')
  if (!esEnteroOpcionalValido(purchaseId)) errores.push('purchaseId inválido')
  if (typeof activo !== 'boolean') errores.push('activo debe ser boolean')

  if (!esFechaIso8601Valida(lastSync)) {
    errores.push('lastSync inválido (se requiere ISO-8601 completo, ej. 2026-07-30T14:25:10Z)')
  }

  if (errores.length > 0) {
    return { ok: false, status: 422, error: errores.join('; ') }
  }

  return {
    ok: true,
    value: {
      eventId,
      payloadVersion,
      palletId,
      cantidadTotal,
      productos: productosNormalizados,
      ubicacion: ubicacion ?? null,
      workcenter: workcenter ?? null,
      operador: operador ?? null,
      workOrderId: workOrderId ?? null,
      sourceOrderId: sourceOrderId ?? null,
      woType: woType ?? null,
      purchaseId: purchaseId ?? null,
      activo,
      lastSync: normalizarLastSync(lastSync),
    },
  }
}

const MENSAJES_RESULTADO = {
  creado: 'Pallet creado',
  actualizado: 'Pallet actualizado',
  ignorado_desactualizado: 'Snapshot recibido es igual o anterior al almacenado; se ignora',
}

// ─── Regla vigente para lastSync empatado (decisión explícita v1) ──────
//
// La condición de actualización es "lastSync recibido > lastSync
// almacenado" (estrictamente mayor). Un lastSync IGUAL al almacenado se
// ignora siempre — incluso si el contenido (productos, cantidadTotal,
// activo, etc.) es distinto del guardado. No se compara contenido, solo
// la marca temporal. Esto es una limitación aceptada para v1: si Cubicaje
// necesitara corregir un dato sin poder avanzar lastSync, esa corrección
// NO se aplicaría con el diseño actual. No se agregan hashes de contenido
// ni un esquema de versionado adicional en este bloque — ver lib/
// integration-cubicaje-db.js (upsertSiMasNuevo) para la implementación
// exacta de esta condición.

// Procesa un payload ya validado contra el repositorio inyectado.
// `repos` = { pallets, eventos, syncStatus } — ver lib/integration-cubicaje-db.js
// para la implementación real sobre Mongo, o un fake en memoria para tests.
export async function procesarPalletCubicaje(repos, payload, ahora = new Date()) {
  const { pallets, eventos, syncStatus } = repos

  const eventoExistente = await eventos.findOne({ eventId: payload.eventId })
  if (eventoExistente) {
    return { status: eventoExistente.httpStatus, body: eventoExistente.respuesta, repetido: true }
  }

  const resultado = await pallets.upsertSiMasNuevo(
    {
      palletId: payload.palletId,
      lastSync: payload.lastSync,
      campos: {
        cantidadTotal: payload.cantidadTotal,
        productos: payload.productos,
        ubicacion: payload.ubicacion,
        workcenter: payload.workcenter,
        operador: payload.operador,
        workOrderId: payload.workOrderId,
        sourceOrderId: payload.sourceOrderId,
        woType: payload.woType,
        purchaseId: payload.purchaseId,
        activo: payload.activo,
        payloadVersion: payload.payloadVersion,
        ultimoEventId: payload.eventId,
      },
    },
    ahora
  )

  const httpStatus = resultado === 'creado' ? 201 : 200
  const respuesta = {
    status: resultado,
    palletId: payload.palletId,
    eventId: payload.eventId,
    detalle: MENSAJES_RESULTADO[resultado],
  }

  try {
    await eventos.insertOne({
      eventId: payload.eventId,
      palletId: payload.palletId,
      payloadVersion: payload.payloadVersion,
      resultado,
      lastSyncRecibido: payload.lastSync,
      recibidoEn: ahora,
      httpStatus,
      respuesta,
    })
  } catch (err) {
    // Carrera: otro proceso ya insertó el mismo eventId concurrentemente.
    // No es un error real — el resultado ya calculado sigue siendo válido.
    if (err?.code !== 11000) throw err
  }

  await syncStatus.updateOne(
    { fuente: 'cubicaje' },
    {
      $set: { ultimoEventoRecibidoEn: ahora, ultimoLastSyncProcesado: payload.lastSync },
      $inc: { totalEventosRecibidos: 1 },
    },
    { upsert: true }
  )

  return { status: httpStatus, body: respuesta, repetido: false }
}

// ─── Serialización pública de un pallet (Bloque 2, lookup GET) ─────────
//
// Construye explícitamente el objeto que se expone al frontend a partir
// del documento interno de Mongo. Nunca reenvía el documento completo:
// deja fuera _id, ultimoEventId, payloadVersion, workOrderId, sourceOrderId,
// woType, purchaseId, recibidoEn/actualizadoEn — son identificadores del
// ERP y metadata de auditoría interna que la UI de Pedidos no usa. Si
// algún campo nuevo se agrega al documento interno en el futuro, no se
// filtra automáticamente aquí (whitelist explícita, no blacklist).
export function serializarPalletPublico(pallet) {
  return {
    palletId: pallet.palletId,
    cantidadTotal: pallet.cantidadTotal,
    productos: (Array.isArray(pallet.productos) ? pallet.productos : []).map((p) => ({
      sku: p.sku,
      condicion: p.condicion,
      cantidad: p.cantidad,
      numeroSerie: p.numeroSerie ?? null,
    })),
    ubicacion: pallet.ubicacion,
    workcenter: pallet.workcenter,
    operador: pallet.operador,
    activo: pallet.activo,
    lastSync: pallet.lastSync,
  }
}
