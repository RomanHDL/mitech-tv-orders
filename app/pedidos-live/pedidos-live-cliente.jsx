'use client'

import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBox, IconRefresh, IconSearch } from '../components/icons'
import { localeDe } from '@/lib/intl-format'

// Los nombres de estatus vienen de SOP.vw_StatusInternal (17 valores fijos
// del WMS). Los agrupamos en unas pocas clases visuales.
function claseEstatus(estatus) {
  const e = (estatus || '').toLowerCase()
  if (e.includes('cancel')) return 'cancelado'
  if (e.includes('not stock') || e.includes('oversold') || e.includes('not found') || e.includes('unmapped')) {
    return 'problema'
  }
  if (e.includes('shipped') || e.includes('send -')) return 'enviado'
  if (e.includes('ready')) return 'listo'
  if (e.includes('pick') || e.includes('multiple') || e.includes('assign') || e.includes('above')) {
    return 'proceso'
  }
  return 'recibido'
}

function formatMoneda(total, moneda, lang) {
  if (total === null || total === undefined) return '—'
  try {
    return new Intl.NumberFormat(localeDe(lang), { style: 'currency', currency: moneda || 'MXN' }).format(total)
  } catch {
    return `${total} ${moneda || ''}`.trim()
  }
}

function formatFechaMovimiento(iso, lang) {
  if (!iso) return ''
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(fecha)
}

export default function PedidosLiveCliente({ pedidos }) {
  const { t, i18n } = useTranslation()
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)
  const [detalle, setDetalle] = useState({}) // orderId -> { cargando, error, items }

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter((p) =>
      String(p.orderId).includes(q) ||
      p.webOrderId.toLowerCase().includes(q) ||
      p.accountName.toLowerCase().includes(q) ||
      p.source.toLowerCase().includes(q) ||
      p.cliente.toLowerCase().includes(q)
    )
  }, [pedidos, busqueda])

  const toggleDetalle = async (orderId) => {
    if (abiertoId === orderId) {
      setAbiertoId(null)
      return
    }
    setAbiertoId(orderId)
    if (detalle[orderId]) return // ya cargado, no reconsultar

    setDetalle((prev) => ({ ...prev, [orderId]: { cargando: true } }))
    try {
      const res = await fetch(`/api/pedidos-live/${orderId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('pedidosLive.errorCargarDetalle'))
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, items: data.items || [] } }))
    } catch (err) {
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, error: err.message } }))
    }
  }

  return (
    <div className="card">
      <div className="lista-toolbar">
        <div className="search-box">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder={t('pedidosLive.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {pedidosFiltrados.length === 0 ? (
        <div className="empty">
          <p>{t('pedidosLive.sinResultados', { busqueda })}</p>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla-pedidos">
            <thead>
              <tr>
                <th>{t('pedidosLive.colPedido')}</th>
                <th>{t('pedidosLive.colMarketplace')}</th>
                <th>{t('pedidosLive.colCuenta')}</th>
                <th>{t('pedidosLive.colCliente')}</th>
                <th>{t('pedidosLive.colEstatus')}</th>
                <th>{t('pedidosLive.colTotal')}</th>
                <th>{t('pedidosLive.colFecha')}</th>
                <th>{t('pedidosLive.colUbicacion')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((p) => {
                const d = detalle[p.orderId]
                const abierto = abiertoId === p.orderId
                return (
                  <Fragment key={p.orderId}>
                    <tr>
                      <td data-label={t('pedidosLive.colPedido')}>
                        <div className="pedido-nombre">
                          #{p.orderId}
                          {p.webOrderId && <span className="tag-empty">{p.webOrderId}</span>}
                        </div>
                      </td>
                      <td data-label={t('pedidosLive.colMarketplace')}>{p.source || '—'}</td>
                      <td data-label={t('pedidosLive.colCuenta')}>{p.accountName || '—'}</td>
                      <td data-label={t('pedidosLive.colCliente')}>{p.cliente || '—'}</td>
                      <td data-label={t('pedidosLive.colEstatus')}>
                        <span className={`badge-estatus ${claseEstatus(p.estatus)}`}>{p.estatus}</span>
                      </td>
                      <td data-label={t('pedidosLive.colTotal')}>
                        <span className="numero-grande">{formatMoneda(p.total, p.moneda, i18n.language)}</span>
                      </td>
                      <td data-label={t('pedidosLive.colFecha')}>{p.fechaFmt}</td>
                      <td data-label={t('pedidosLive.colUbicacion')}>{p.ubicacion || '—'}</td>
                      <td>
                        <div className="acciones">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleDetalle(p.orderId)}
                          >
                            <IconBox />
                            {abierto ? t('pedidosLive.ocultar') : t('pedidosLive.ver')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="fila-detalle">
                        <td colSpan={9}>
                          {!d || d.cargando ? (
                            <p className="detalle-cargando">
                              <IconRefresh /> {t('pedidosLive.cargandoDetalle')}
                            </p>
                          ) : d.error ? (
                            <p className="detalle-error">{d.error}</p>
                          ) : d.items.length === 0 ? (
                            <p className="detalle-vacio">{t('pedidosLive.sinArticulos')}</p>
                          ) : (
                            <table className="tabla-detalle-items">
                              <thead>
                                <tr>
                                  <th>{t('pedidosLive.colSku')}</th>
                                  <th>{t('pedidosLive.colDescripcion')}</th>
                                  <th>{t('pedidosLive.colCant')}</th>
                                  <th>{t('pedidosLive.colPallet')}</th>
                                  <th>{t('pedidosLive.colUltimoMovimiento')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.items.map((it) => (
                                  <tr key={it.orderItemsId}>
                                    <td>{it.sku || '—'}</td>
                                    <td>{it.itemDescription || '—'}</td>
                                    <td>{it.qty ?? '—'}</td>
                                    <td>{it.binCode || '—'}</td>
                                    <td>
                                      {it.ultimoMovimiento
                                        ? `${it.ultimoMovimiento.tipoMovimiento} · ${it.ultimoMovimiento.movidoPor} (${formatFechaMovimiento(it.ultimoMovimiento.fecha, i18n.language)})`
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
