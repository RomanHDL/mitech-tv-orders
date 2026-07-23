import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import { TIPO_EVENTO_POR_DESTINO, detallePorDestino } from '@/lib/eventos'
import { getServerT } from '@/lib/i18n-server'

// Migración one-shot (idempotente, se puede correr varias veces sin
// duplicar): respalda en la colección `eventos` lo único que SÍ se puede
// reconstruir con certeza a partir de datos reales ya guardados:
//
//   1. "Pedido creado" — a partir de pedido.fecha/creadoPor, que siempre
//      existieron.
//   2. Las transiciones de etapa ya registradas en pedido.historialEstados
//      (Cargando/Listo para salida/Despachado/Cancelado), con su fecha y
//      usuario reales.
//
// NO se inventan eventos de "Edición", "Surtido iniciado/terminado" ni
// "Cambio de dueño" para pedidos viejos: no existe ningún registro de CUÁNDO
// pasó eso antes de esta migración, y esta app no fabrica autores ni fechas.
// Esos eventos solo existen para pedidos a partir de ahora (ver los
// endpoints que llaman a registrarEvento).
//
// POST /api/admin/migrar-eventos — solo admin.
export async function POST() {
  const t = await getServerT()
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }

  const db = await getDb()
  const pedidos = await db.collection('pedidos').find({}).toArray()

  let creacionesInsertadas = 0
  let transicionesInsertadas = 0
  let pedidosRevisados = 0

  for (const p of pedidos) {
    pedidosRevisados++
    const pedidoId = p._id.toString()
    const snapshot = {
      pedidoId,
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre || '',
      condiciones: p.condiciones || [],
    }

    const yaTieneCreacion = await db.collection('eventos').findOne({ pedidoId, tipo: 'CREACION' })
    if (!yaTieneCreacion && p.fecha) {
      const totalTvs = (p.televisiones || []).length
      await db.collection('eventos').insertOne({
        ...snapshot,
        tipo: 'CREACION',
        estadoAnterior: null,
        estadoNuevo: 'PENDIENTE',
        usuarioId: p.creadoPor || null,
        usuarioNombre: p.creadoPorNombre || null,
        detalle: t('eventosDetalle.pedidoCreado'),
        detalleSecundario: totalTvs > 0 ? t('eventosDetalle.modelosCapturados', { count: totalTvs }) : null,
        metadata: {},
        creadoEn: p.fecha,
      })
      creacionesInsertadas++
    }

    for (const h of p.historialEstados || []) {
      if (!h?.fecha || !h?.estadoNuevo) continue
      const yaExiste = await db.collection('eventos').findOne({
        pedidoId,
        estadoNuevo: h.estadoNuevo,
        creadoEn: h.fecha,
      })
      if (yaExiste) continue

      await db.collection('eventos').insertOne({
        ...snapshot,
        tipo: TIPO_EVENTO_POR_DESTINO[h.estadoNuevo] || 'CAMBIO_ESTADO',
        estadoAnterior: h.estadoAnterior || null,
        estadoNuevo: h.estadoNuevo,
        usuarioId: h.usuarioId || null,
        usuarioNombre: h.usuarioNombre || null,
        detalle: detallePorDestino(t, h.estadoNuevo) || h.estadoNuevo,
        detalleSecundario: h.observacion || null,
        metadata: {},
        creadoEn: h.fecha,
      })
      transicionesInsertadas++
    }
  }

  return NextResponse.json({
    pedidosRevisados,
    creacionesInsertadas,
    transicionesInsertadas,
  })
}
