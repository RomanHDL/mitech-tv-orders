import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError } from '@/lib/integration-cubicaje'
import { getRepositorioPedidoPalletLinks } from '@/lib/integration-pedido-pallet-links-db'
import { desvincularPallet, validarDesvincularInput } from '@/lib/integration-pedido-pallet-links'

// Desvincula lógicamente un pallet de un pedido (nunca se borra el
// documento, solo se marca activo:false — ver lib/integration-pedido-
// pallet-links.js). Idempotente: una segunda desvinculación no falla.
// Mismo criterio de autorización que vincular/agregar-sku.
export async function POST(req, { params }) {
  const t = await getServerT()
  const { id, palletId } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }
  if (typeof palletId !== 'string' || !palletId.trim()) {
    return NextResponse.json({ error: t('apiPallets.palletIdInvalido') }, { status: 400 })
  }

  let body = null
  const rawBody = await req.text()
  if (rawBody) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
    }
  }

  const validacion = validarDesvincularInput(body)
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: validacion.status })
  }

  try {
    const db = await getDb()

    const pedido = await db.collection('pedidos').findOne(
      { _id: new ObjectId(id) },
      { projection: { creadoPor: 1 } }
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

    const repo = await getRepositorioPedidoPalletLinks()
    const resultado = await desvincularPallet(repo, {
      pedidoId: id,
      palletId: palletId.trim(),
      motivo: validacion.value.motivo,
      usuario,
    })

    return NextResponse.json(resultado.body, { status: resultado.status })
  } catch (err) {
    console.error('[pedidos/pallets/desvincular] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json({ error: t('apiPallets.errorInterno') }, { status: 500 })
  }
}
