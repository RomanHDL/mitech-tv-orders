import { redirect } from 'next/navigation'
import { getRol, homeDelRol } from '@/lib/auth'
import { getPedidosLive } from '@/lib/sqlserver'
import PedidosLiveCliente from './pedidos-live-cliente'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe } from '@/lib/intl-format'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function obtenerPedidosLive(t, lang) {
  const filas = await getPedidosLive({ limit: 150 })

  const fmt = new Intl.DateTimeFormat(localeDe(lang), {
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
    estatus: p.Estatus || t('pedidosLive.sinEstatus'),
    moneda: p.CurrencyCode || 'MXN',
    total: p.Total,
    fechaFmt: p.EnteredDate ? fmt.format(new Date(p.EnteredDate)) : '—',
    ubicacion: p.Location || '',
  }))
}

export default async function PedidosLivePage() {
  const t = await getServerT()
  const lang = await getServerLang()
  const rol = await getRol()
  if (rol !== 'admin') {
    redirect(homeDelRol(rol))
  }

  let pedidos = []
  let error = null
  try {
    pedidos = await obtenerPedidosLive(t, lang)
  } catch (err) {
    error = err.message || t('pedidosLive.errorConexion')
  }

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('pedidosLive.titulo')}</h1>
        <p className="subtitle">
          {error
            ? t('pedidosLive.subtituloError')
            : t('pedidosLive.subtituloPedidos', { count: pedidos.length })}
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
