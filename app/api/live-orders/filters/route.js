import { NextResponse } from 'next/server'
import { requireModule } from '@/lib/auth'
import { fetchLiveOrdersFilters } from '@/lib/cubicajeClient'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/live-orders/filters — valores reales distintos (estado,
// marketplace, cuenta, ubicación) para poblar los selects de filtro.
export async function GET() {
  const t = await getServerT()
  const chk = await requireModule('live-orders')
  if (!chk.ok) return NextResponse.json({ success: false, error: chk.error }, { status: chk.status })

  try {
    const respuesta = await fetchLiveOrdersFilters()
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return NextResponse.json(
      { success: false, error: err.message || t('pedidosLive.errorConexion') },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
