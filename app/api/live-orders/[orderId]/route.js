import { NextResponse } from 'next/server'
import { requireModule } from '@/lib/auth'
import { fetchLiveOrderItems } from '@/lib/cubicajeClient'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/live-orders/[orderId] — detalle (artículos + último movimiento
// de pallet) de un pedido en vivo, vía el puente de Cubicaje.
export async function GET(request, { params }) {
  const t = await getServerT()
  const chk = await requireModule('live-orders')
  if (!chk.ok) return NextResponse.json({ success: false, error: chk.error }, { status: chk.status })

  const { orderId: orderIdParam } = await params
  const orderId = Number(orderIdParam)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { success: false, error: t('apiPedidosLive.orderIdInvalido') },
      { status: 400 }
    )
  }

  try {
    const respuesta = await fetchLiveOrderItems(orderId)
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return NextResponse.json(
      { success: false, error: err.message || t('apiPedidosLive.errorConsultarWms') },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
