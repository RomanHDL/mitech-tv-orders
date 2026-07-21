import { getDb } from './mongodb'

// ─── Bitácora de auditoría de pedidos ────────────────────────────────
//
// Colección `eventos`: un documento por movimiento real de un pedido
// (creación, edición, surtido, carga, despacho, cancelación, cambio de
// dueño). Nunca se escriben eventos "inventados" — solo se llama a
// registrarEvento() desde los mismos endpoints que ya mutan el pedido,
// en el momento real en que ocurre la acción.
//
// Se guardan snapshots (numeroPedido/pedidoNombre/condiciones/usuarioNombre)
// para poder listar y buscar sin tener que hacer join con `pedidos` en cada
// consulta — si el pedido se renombra después, el evento conserva el nombre
// que tenía en ese momento (comportamiento correcto de una bitácora).

let indicesAsegurados = false

async function asegurarIndices(db) {
  if (indicesAsegurados) return
  const col = db.collection('eventos')
  await Promise.all([
    col.createIndex({ creadoEn: -1 }),
    col.createIndex({ pedidoId: 1, creadoEn: -1 }),
    col.createIndex({ tipo: 1 }),
    col.createIndex({ usuarioId: 1 }),
    col.createIndex({
      numeroPedido: 'text',
      pedidoNombre: 'text',
      detalle: 'text',
      usuarioNombre: 'text',
    }),
  ]).catch(() => {
    // Si ya existe un índice de texto distinto (p. ej. de una corrida previa
    // con otras opciones) createIndex puede fallar — no es fatal, los demás
    // índices sí se crean por ser llamadas independientes en el Promise.all.
  })
  indicesAsegurados = true
}

// Registra un evento real. `pedido` es el documento crudo de Mongo (o un
// snapshot equivalente) del que se toman numeroPedido/pedidoNombre/condiciones.
export async function registrarEvento(db, pedido, {
  tipo,
  estadoAnterior = null,
  estadoNuevo = null,
  usuarioId = null,
  usuarioNombre = null,
  detalle,
  detalleSecundario = null,
  metadata = {},
  fecha = null,
}) {
  await asegurarIndices(db)
  await db.collection('eventos').insertOne({
    pedidoId: (pedido._id || pedido.id).toString(),
    numeroPedido: pedido.numeroPedido || '',
    pedidoNombre: pedido.pedidoNombre || '',
    condiciones: pedido.condiciones || [],
    tipo,
    estadoAnterior,
    estadoNuevo,
    usuarioId: usuarioId || null,
    usuarioNombre: usuarioNombre || null,
    detalle: detalle || '',
    detalleSecundario,
    metadata,
    creadoEn: fecha || new Date(),
  })
}

// Mapeo de estado destino (transición manual de etapa) → tipo de evento del
// historial. Compartido entre el endpoint de transición y la migración de
// respaldo, para no tener dos copias que se puedan desincronizar.
export const TIPO_EVENTO_POR_DESTINO = {
  CARGANDO: 'CARGA',
  LISTO_SALIDA: 'CAMBIO_ESTADO',
  DESPACHADO: 'DESPACHO',
  CANCELADO: 'CANCELACION',
}

export const DETALLE_POR_DESTINO = {
  CARGANDO: 'Carga iniciada',
  LISTO_SALIDA: 'Pedido listo para salida',
  DESPACHADO: 'Pedido despachado',
  CANCELADO: 'Pedido cancelado',
}

// Categorías de la navegación horizontal del historial — agrupan tipos de
// evento más finos en cubetas amplias para la barra de categorías.
export const CATEGORIAS_EVENTO = {
  todos: null,
  cambios_estado: ['CAMBIO_ESTADO', 'CARGA'],
  ediciones: ['EDICION', 'CAMBIO_CANTIDADES'],
  despachos: ['DESPACHO'],
  cancelaciones: ['CANCELACION'],
  creaciones: ['CREACION'],
  otros: ['OTRO', 'CAMBIO_DUENO', 'SURTIDO'],
}

// Arma el filtro Mongo a partir de los parámetros de búsqueda ya
// validados/saneados. `usuario` acota por dueño para capturista (mismo
// criterio que el resto del módulo: solo ve lo suyo).
export function construirFiltroEventos({
  busqueda, desde, hasta, estado, tipoEvento, usuarioId, condicion, categoria,
  pedidoIdsDeCapturista,
}) {
  const filtro = {}

  if (pedidoIdsDeCapturista) {
    filtro.pedidoId = { $in: pedidoIdsDeCapturista }
  }

  if (busqueda && busqueda.trim()) {
    const q = busqueda.trim()
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filtro.$or = [
      { numeroPedido: regex },
      { pedidoNombre: regex },
      { usuarioNombre: regex },
      { detalle: regex },
      { 'metadata.sku': regex },
    ]
  }

  if (desde || hasta) {
    filtro.creadoEn = {}
    if (desde) filtro.creadoEn.$gte = new Date(desde)
    if (hasta) {
      const h = new Date(hasta)
      h.setHours(23, 59, 59, 999)
      filtro.creadoEn.$lte = h
    }
  }

  if (estado && estado !== 'todos') {
    filtro.$and = [
      ...(filtro.$and || []),
      { $or: [{ estadoNuevo: estado }, { estadoAnterior: estado }] },
    ]
  }

  // La categoría (pestañas) y el tipo de evento (select granular) filtran lo
  // mismo con distinta finura — si el usuario fijó un tipo específico, ese
  // gana; si no, se usa la cubeta más amplia de la categoría activa.
  if (tipoEvento && tipoEvento !== 'todos') {
    filtro.tipo = tipoEvento
  } else if (categoria && categoria !== 'todos' && CATEGORIAS_EVENTO[categoria]) {
    filtro.tipo = { $in: CATEGORIAS_EVENTO[categoria] }
  }

  if (usuarioId && usuarioId !== 'todos') {
    filtro.usuarioId = usuarioId
  }

  if (condicion && condicion !== 'todos') {
    filtro.condiciones = condicion
  }

  return filtro
}

// Igual criterio que /pedidos y /historial: una capturista solo ve eventos
// de pedidos cuyo dueño es ella misma. Devuelve null si no aplica scoping
// (admin/surtidor ven todo).
export async function idsDePedidosDeCapturista(db, usuario) {
  if (usuario?.rol !== 'capturista') return null
  const pedidos = await db
    .collection('pedidos')
    .find({ creadoPor: usuario.userId }, { projection: { _id: 1 } })
    .toArray()
  return pedidos.map((p) => p._id.toString())
}
