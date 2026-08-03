import { redirect } from 'next/navigation'
import { getRol, homeDelRol } from '@/lib/auth'
import PedidosLiveCliente from './pedidos-live-cliente'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ya no consulta el WMS aquí (eso quedaba bloqueando el render completo de
// la página mientras Vercel no podía alcanzar BinManagerRO — la causa real
// del "se queda cargando"). Este Server Component solo valida el rol; los
// pedidos los trae el cliente vía /api/live-orders con su propio manejo de
// carga/error/reintento.
export default async function PedidosLivePage() {
  const t = await getServerT()
  const rol = await getRol()
  if (rol !== 'admin') {
    redirect(homeDelRol(rol))
  }

  return (
    <main className="page-wide">
      <PedidosLiveCliente titulo={t('pedidosLive.titulo')} />
    </main>
  )
}
