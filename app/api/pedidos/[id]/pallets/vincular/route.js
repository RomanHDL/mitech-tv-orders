import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError } from '@/lib/integration-cubicaje'
import { getRepositorioPedidoPalletLinks } from '@/lib/integration-pedido-pallet-links-db'
import { validarVincularInput, vincularPallet } from '@/lib/integration-pedido-pallet-links'

// Vincula manualmente un pallet (ya recibido de Cubicaje) a un pedido.
// Mismo criterio de autorización que POST /api/pedidos/[id]/agregar-sku:
// admin sin restricción, capturista con módulo 'orders' + dueño del
// pedido, surtidor con módulo 'picking'.
export async function POST(req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const validacion = validarVincularInput(body)
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: validacion.status })
  }

  try {
    const db = await getDb()

    const pedido = await db.collection('pedidos').findOne(
      { _id: new ObjectId(id) },
      { projection: { creadoPor: 1, numeroPedido: 1, televisiones: 1 } }
    )
    if (!pedido) {
      return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
    }

    const usuario = await getUsuario()
    if (usuario?.rol === 'capturista') {
      const chk = await requireModule('orders')
      if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
      if (pedido.creadoPor !== usuario.userId) {
        return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
      }
    } else if (usuario?.rol === 'surtidor') {
      const chk = await requireModule('picking')
      if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
    }

    const pallet = await db.collection('integrationCubicajePallets').findOne({ palletId: validacion.value.palletId })
    if (!pallet) {
      return NextResponse.json({ error: t('apiPallets.palletNoEncontrado') }, { status: 404 })
    }

    const repo = await getRepositorioPedidoPalletLinks()
    const resultado = await vincularPallet(repo, {
      pedidoId: id,
      numeroPedidoSnapshot: pedido.numeroPedido,
      palletId: validacion.value.palletId,
      usuario,
    })

    return NextResponse.json(resultado.body, { status: resultado.status })
  } catch (err) {
    console.error('[pedidos/pallets/vincular] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json({ error: t('apiPallets.errorInterno') }, { status: 500 })
  }
}
