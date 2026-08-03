import { NextResponse } from 'next/server'
import { requireModule } from '@/lib/auth'
import { fetchLiveOrders } from '@/lib/cubicajeClient'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/live-orders — función privada de servidor para "Pedidos en
// vivo" (/pedidos-live). Único punto donde este proyecto habla con
// Cubicaje; el navegador nunca ve CUBICAJE_API_URL ni CUBICAJE_INTEGRATION_KEY.
export async function GET(request) {
  const t = await getServerT()
  const chk = await requireModule('live-orders')
  if (!chk.ok) return NextResponse.json({ success: false, error: chk.error }, { status: chk.status })

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 150
  const search = searchParams.get('search') || undefined
  const orderNumber = searchParams.get('orderNumber') || undefined
  const palletId = searchParams.get('palletId') || undefined
  const estado = searchParams.get('estado') || undefined
  const fecha = searchParams.get('fecha') || undefined

  try {
    const respuesta = await fetchLiveOrders({ page, limit, search, orderNumber, palletId, estado, fecha })
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return NextResponse.json(
      { success: false, error: err.message || t('pedidosLive.errorConexion') },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
