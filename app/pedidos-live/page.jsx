import { redirect } from 'next/navigation'
import { getRol, homeDelRol } from '@/lib/auth'
import { getPedidosLive } from '@/lib/sqlserver'
import PedidosLiveCliente from './pedidos-live-cliente'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function obtenerPedidosLive() {
  const filas = await getPedidosLive({ limit: 150 })

  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })

  return filas.map((p) => ({
    orderId: p.OrderID,
    webOrderId: p.WebOrderID || '',
    source: p.Source || '',
    accountName: p.AccountName || '',
    cliente: p.FullName || p.CompanyName || '',
    estatus: p.Estatus || 'Sin estatus',
    moneda: p.CurrencyCode || 'MXN',
    total: p.Total,
    fechaFmt: p.EnteredDate ? fmt.format(new Date(p.EnteredDate)) : '—',
    ubicacion: p.Location || '',
  }))
}

export default async function PedidosLivePage() {
  const rol = await getRol()
  if (rol !== 'admin') {
    redirect(homeDelRol(rol))
  }

  let pedidos = []
  let error = null
  try {
    pedidos = await obtenerPedidosLive()
  } catch (err) {
    error = err.message || 'No se pudo conectar al WMS'
  }

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Pedidos en vivo (WMS)</h1>
        <p className="subtitle">
          {error
            ? 'No se pudo conectar al WMS.'
            : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} · datos en tiempo real`}
        </p>
      </div>

      {error ? (
        <div className="card">
          <div className="alerta alerta-error">
            <span>{error}</span>
          </div>
        </div>
      ) : (
        <PedidosLiveCliente pedidos={pedidos} />
      )}
    </main>
  )
}
