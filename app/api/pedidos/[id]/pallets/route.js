import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError } from '@/lib/integration-cubicaje'
import { getRepositorioPedidoPalletLinks } from '@/lib/integration-pedido-pallet-links-db'
import { detectarDiscrepanciasBasicas } from '@/lib/integration-pedido-pallet-links'

// Lista los pallets vinculados (activos) a un pedido, con la información
// actual del pallet (de integrationCubicajePallets) y discrepancias
// básicas de SKU/condición. Auth: cualquier rol logueado (regla general de
// GET en middleware.js) — es solo lectura.
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
      { projection: { televisiones: 1 } }
    )
    if (!pedido) {
      return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
    }

    const repo = await getRepositorioPedidoPalletLinks()
    const links = await repo.listarPorPedido(id, { soloActivos: true })

    const palletIds = links.map((l) => l.palletId)
    const pallets = palletIds.length
      ? await db.collection('integrationCubicajePallets').find({ palletId: { $in: palletIds } }).toArray()
      : []
    const palletsPorId = new Map(pallets.map((p) => [p.palletId, p]))

    const vinculados = links.map((link) => {
      const pallet = palletsPorId.get(link.palletId) || null
      return {
        palletId: link.palletId,
        vinculadoPor: link.vinculadoPor,
        vinculadoPorNombre: link.vinculadoPorNombre,
        vinculadoEn: link.vinculadoEn,
        cantidadTotal: pallet?.cantidadTotal ?? null,
        productos: pallet?.productos ?? [],
        ubicacion: pallet?.ubicacion ?? null,
        operador: pallet?.operador ?? null,
        lastSync: pallet?.lastSync ?? null,
        activoEnCubicaje: pallet?.activo ?? null,
        discrepancias: pallet ? detectarDiscrepanciasBasicas(pedido, pallet.productos) : [],
      }
    })

    return NextResponse.json({ vinculados })
  } catch (err) {
    console.error('[pedidos/pallets] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json({ error: t('apiPallets.errorInterno') }, { status: 500 })
  }
}
