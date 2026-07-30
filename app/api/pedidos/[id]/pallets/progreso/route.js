import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError } from '@/lib/integration-cubicaje'
import { getRepositorioPedidoPalletLinks } from '@/lib/integration-pedido-pallet-links-db'
import { calcularProgresoPedido } from '@/lib/integration-pedido-progreso'

// Progreso sincronizado del pedido a partir de sus pallets vinculados
// activos. Puramente informativo — nunca escribe cantidadSurtida ni
// ningún otro campo del pedido.
//
// Autorización EN EL HANDLER (no solo en middleware.js), armonizada con
// GET /api/pedidos/[id]/pallets: admin sin restricción; capturista debe
// tener módulo 'orders' Y ser dueño del pedido; surtidor debe tener
// módulo 'picking'; sin sesión -> 401; rol desconocido -> 403. Antes esta
// ruta dejaba pasar sin restricción cualquier usuario/rol que no fuera
// exactamente 'capturista' o 'surtidor' (incluyendo un usuario sin cookie
// o un rol inexistente) — corregido aquí.
export async function GET(_req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  try {
    const db = await getDb()
    const pedido = await db.collection('pedidos').findOne(
      { _id: new ObjectId(id) },
      { projection: { creadoPor: 1, numeroPedido: 1, cantidadTotal: 1, televisiones: 1 } }
    )
    if (!pedido) {
      return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
    }

    const usuario = await getUsuario()
    if (!usuario) {
      return NextResponse.json({ error: t('apiComun.noAutenticado') }, { status: 401 })
    }
    if (usuario.rol === 'capturista') {
      const chk = await requireModule('orders')
      if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
      if (pedido.creadoPor !== usuario.userId) {
        return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
      }
    } else if (usuario.rol === 'surtidor') {
      const chk = await requireModule('picking')
      if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
    } else if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
    }

    const repo = await getRepositorioPedidoPalletLinks()
    const links = await repo.listarPorPedido(id, { soloActivos: true })

    const palletIds = links.map((l) => l.palletId)
    const pallets = palletIds.length
      ? await db.collection('integrationCubicajePallets').find({ palletId: { $in: palletIds } }).toArray()
      : []
    const palletsPorId = new Map(pallets.map((p) => [p.palletId, p]))

    const vinculos = links.map((link) => ({ link, pallet: palletsPorId.get(link.palletId) || null }))

    const { resumen, lineas, discrepancias, advertencias } = calcularProgresoPedido(pedido, vinculos)

    return NextResponse.json({
      pedidoId: id,
      numeroPedido: pedido.numeroPedido,
      resumen,
      lineas,
      discrepancias,
      advertencias,
      actualizadoEn: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[pedidos/pallets/progreso] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json({ error: t('apiPallets.errorInterno') }, { status: 500 })
  }
}
