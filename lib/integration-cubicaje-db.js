import { getDb } from './mongodb'
import { sanitizarMensajeError } from './integration-cubicaje'

// ─── Colecciones de integración Cubicaje → Pedidos ─────────────────────
//
// Prefijo "integration" en las 3 colecciones a propósito (ver discusión
// de nombres): ya existe "pallet" en este repo como unidad de captura de
// un TV (lib/catalogos.js UNIDADES) y como concepto de drill-down de solo
// lectura del WMS (lib/palletApi.js) — estos nombres dejan explícito que
// son datos de la integración con Cubicaje, sin relación con esos otros dos.
//
// Mismo patrón de "asegurar índices una vez por proceso" que lib/eventos.js.

let indicesAsegurados = false

// Los índices únicos de palletId y eventId son requisitos de integridad
// (evitan duplicados a nivel de base de datos, no son una optimización).
// Por eso, a diferencia de lib/eventos.js, NO se tragan los errores aquí:
// createIndex() con la MISMA definición ya es idempotente por sí solo
// (Mongo simplemente resuelve sin error si el índice ya existe igual) —
// un error real aquí significa conexión caída, permisos insuficientes,
// conflicto de definición, o datos existentes que violan la restricción
// única, y en cualquiera de esos casos la app NO debe seguir asumiendo
// que la integridad está garantizada. Se espera cada createIndex de forma
// explícita y secuencial (no Promise.all) para que el punto de fallo sea
// determinista y fácil de probar. indicesAsegurados solo se marca true
// si las 4 llamadas resolvieron sin lanzar.
async function asegurarIndices(db) {
  if (indicesAsegurados) return
  try {
    await db.collection('integrationCubicajePallets').createIndex({ palletId: 1 }, { unique: true })
    await db.collection('integrationCubicajeEvents').createIndex({ eventId: 1 }, { unique: true })
    await db.collection('integrationCubicajeEvents').createIndex({ palletId: 1, recibidoEn: -1 })
    await db.collection('integrationCubicajeSyncStatus').createIndex({ fuente: 1 }, { unique: true })
  } catch (err) {
    console.error('[integration-cubicaje-db] Error al asegurar índices:', sanitizarMensajeError(err))
    throw new Error('No se pudieron asegurar los índices de integración de Cubicaje')
  }
  indicesAsegurados = true
}

// Envuelve la colección real de pallets para exponer una sola operación:
// "actualiza solo si el snapshot es más nuevo, o inserta si no existe".
// Resuelve la condición de carrera de forma atómica en Mongo (no en JS):
// si el filtro con `lastSync: {$lt: nuevo}` no matchea un doc existente
// (porque ya tiene un lastSync igual o más nuevo), el upsert intenta
// insertar un doc nuevo y choca con el índice único de palletId — ese
// choque (E11000) es la señal de "ignorar", no un error real.
function crearRepositorioPallets(col) {
  return {
    async upsertSiMasNuevo({ palletId, lastSync, campos }, ahora) {
      try {
        const res = await col.findOneAndUpdate(
          { palletId, lastSync: { $lt: lastSync } },
          {
            $set: { ...campos, lastSync, actualizadoEn: ahora },
            $setOnInsert: { palletId, recibidoEn: ahora },
          },
          { upsert: true, includeResultMetadata: true }
        )
        return res.lastErrorObject?.upserted ? 'creado' : 'actualizado'
      } catch (err) {
        if (err?.code !== 11000) throw err
        const updateRes = await col.updateOne(
          { palletId, lastSync: { $lt: lastSync } },
          { $set: { ...campos, lastSync, actualizadoEn: ahora } }
        )
        return updateRes.modifiedCount === 1 ? 'actualizado' : 'ignorado_desactualizado'
      }
    },
  }
}

// Devuelve los 3 "repositorios" que necesita procesarPalletCubicaje().
// `eventos` y `syncStatus` se pasan como colecciones nativas de Mongo
// (findOne/insertOne/updateOne ya calzan con lo que espera esa función).
export async function getColeccionesCubicaje() {
  const db = await getDb()
  await asegurarIndices(db)
  return {
    pallets: crearRepositorioPallets(db.collection('integrationCubicajePallets')),
    eventos: db.collection('integrationCubicajeEvents'),
    syncStatus: db.collection('integrationCubicajeSyncStatus'),
  }
}
