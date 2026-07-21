import { NextResponse } from 'next/server'
import { requireModule } from '@/lib/auth'
import { getItemsDePedido } from '@/lib/sqlserver'
import { getPalletMovimientos } from '@/lib/palletApi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/pedidos-live/[orderId]
// Detalle de un pedido del WMS: sus artículos y, cuando el artículo ya tiene
// un pallet (BinID) asignado, el último movimiento reportado por la API de
// pallets (appsc.mitechnologiesinc.com). Restringido al módulo 'live-orders':
// aunque el middleware permite cualquier GET /api/* a un rol logueado, esta
// vista expone datos internos del WMS (clientes, montos) que solo debe ver
// quien tenga ese módulo permitido (admin por default).
export async function GET(request, { params }) {
  const chk = await requireModule('live-orders')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  const { orderId: orderIdParam } = await params
  const orderId = Number(orderIdParam)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'OrderID inválido' }, { status: 400 })
  }

  try {
    const filas = await getItemsDePedido(orderId)

    const items = await Promise.all(
      filas.map(async (f) => {
        let ultimoMovimiento = null
        if (f.BinCode) {
          try {
            const pallet = await getPalletMovimientos(f.BinCode)
            const mov = pallet?.movimientos?.[0]
            if (mov) {
              ultimoMovimiento = {
                tipoMovimiento: mov.tipoMovimiento,
                movidoPor: mov.movidoPor,
                fecha: mov.fechaMovimiento,
              }
            }
          } catch {
            // La API de pallets puede fallar sin tumbar el detalle del pedido.
          }
        }
        return {
          orderItemsId: f.OrderItemsID,
          sku: f.SKU,
          itemDescription: f.ItemDescription,
          qty: f.Qty,
          amount: f.Amount,
          binCode: f.BinCode || null,
          ultimoMovimiento,
        }
      })
    )

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Error al consultar el WMS' }, { status: 502 })
  }
}
