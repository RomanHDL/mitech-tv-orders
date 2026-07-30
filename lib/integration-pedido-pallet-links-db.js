import { getDb } from './mongodb'
import { sanitizarMensajeError } from './integration-cubicaje'

// ─── Colección integrationPedidoPalletLinks ─────────────────────────────
//
// Cada vinculación/desvinculación es su propio documento (nunca se
// reescribe uno viejo para "revincular") — así la colección entera es el
// historial de auditoría, sin necesitar una tabla de eventos aparte.
//
// Índice único PARCIAL en palletId (solo sobre activo:true): permite que
// el mismo palletId tenga muchos documentos a lo largo del tiempo (uno por
// ciclo vincular/desvincular), pero nunca más de UNO activo a la vez —
// exactamente la regla "un pallet activo no puede estar vinculado a dos
// pedidos". Mismo criterio que lib/integration-cubicaje-db.js: los errores
// de creación de índice se propagan, nunca se tragan en silencio.

let indicesAsegurados = false

async function asegurarIndices(db) {
  if (indicesAsegurados) return
  try {
    await db.collection('integrationPedidoPalletLinks').createIndex(
      { palletId: 1 },
      { unique: true, partialFilterExpression: { activo: true } }
    )
    await db.collection('integrationPedidoPalletLinks').createIndex({ pedidoId: 1, activo: 1 })
  } catch (err) {
    console.error('[integration-pedido-pallet-links-db] Error al asegurar índices:', sanitizarMensajeError(err))
    throw new Error('No se pudieron asegurar los índices de vinculación pedido-pallet')
  }
  indicesAsegurados = true
}

function crearRepositorioLinks(col) {
  return {
    async buscarActivoPorPalletId(palletId) {
      return col.findOne({ palletId, activo: true })
    },
    async listarPorPedido(pedidoId, { soloActivos = true } = {}) {
      const filtro = soloActivos ? { pedidoId, activo: true } : { pedidoId }
      return col.find(filtro).sort({ vinculadoEn: -1 }).toArray()
    },
    async crear(doc) {
      const res = await col.insertOne(doc)
      return { ...doc, _id: res.insertedId }
    },
    async desactivar(id, campos) {
      await col.updateOne({ _id: id }, { $set: { ...campos, activo: false } })
      return col.findOne({ _id: id })
    },
  }
}

export async function getRepositorioPedidoPalletLinks() {
  const db = await getDb()
  await asegurarIndices(db)
  return crearRepositorioLinks(db.collection('integrationPedidoPalletLinks'))
}
