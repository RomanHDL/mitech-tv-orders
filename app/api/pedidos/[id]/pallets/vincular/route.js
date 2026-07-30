import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, requireModule } from '@/lib/auth'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError } from '@/lib/integration-cubicaje'
import { getRepositorioPedidoPalletLinks } from '@/lib/integration-pedido-pallet-links-db'
import { validarVincularInput, vincularPallet } from '@/lib/integration-pedido-pallet-links'

// Vincula manualmente un pallet (ya recibido de Cubicaje) a un pedido.
//
// Autorización EN EL HANDLER (no solo en middleware.js), armonizada con
// los GET de este módulo: admin sin restricción; capturista debe tener
// módulo 'orders' Y ser dueño del pedido; surtidor debe tener módulo
// 'picking'; sin sesión -> 401; rol desconocido -> 403. Antes esta ruta
// dejaba pasar sin restricción cualquier usuario/rol que no fuera
// exactamente 'capturista' o 'surtidor' (incluyendo un usuario sin cookie
// o un rol inexistente) — corregido aquí.
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
