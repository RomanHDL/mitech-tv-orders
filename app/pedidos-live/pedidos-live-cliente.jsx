'use client'

import { Fragment, useMemo, useState } from 'react'
import { IconBox, IconRefresh, IconSearch } from '../components/icons'

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

function formatMoneda(total, moneda) {
  if (total === null || total === undefined) return '—'
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(total)
  } catch {
    return `${total} ${moneda || ''}`.trim()
  }
}

function formatFechaMovimiento(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(fecha)
}

export default function PedidosLiveCliente({ pedidos }) {
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
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el detalle')
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
            placeholder="Buscar por N° pedido, cuenta, cliente o marketplace…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {pedidosFiltrados.length === 0 ? (
        <div className="empty">
          <p>No se encontraron pedidos con "{busqueda}".</p>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla-pedidos">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Marketplace</th>
                <th>Cuenta</th>
                <th>Cliente</th>
                <th>Estatus</th>
                <th>Total</th>
                <th>Fecha</th>
                <th>Ubicación</th>
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
                      <td data-label="Pedido">
                        <div className="pedido-nombre">
                          #{p.orderId}
                          {p.webOrderId && <span className="tag-empty">{p.webOrderId}</span>}
                        </div>
                      </td>
                      <td data-label="Marketplace">{p.source || '—'}</td>
                      <td data-label="Cuenta">{p.accountName || '—'}</td>
                      <td data-label="Cliente">{p.cliente || '—'}</td>
                      <td data-label="Estatus">
                        <span className={`badge-estatus ${claseEstatus(p.estatus)}`}>{p.estatus}</span>
                      </td>
                      <td data-label="Total">
                        <span className="numero-grande">{formatMoneda(p.total, p.moneda)}</span>
                      </td>
                      <td data-label="Fecha">{p.fechaFmt}</td>
                      <td data-label="Ubicación">{p.ubicacion || '—'}</td>
                      <td>
                        <div className="acciones">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleDetalle(p.orderId)}
                          >
                            <IconBox />
                            {abierto ? 'Ocultar' : 'Ver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="fila-detalle">
                        <td colSpan={9}>
                          {!d || d.cargando ? (
                            <p className="detalle-cargando">
                              <IconRefresh /> Cargando detalle del pedido…
                            </p>
                          ) : d.error ? (
                            <p className="detalle-error">{d.error}</p>
                          ) : d.items.length === 0 ? (
                            <p className="detalle-vacio">Sin artículos registrados para este pedido.</p>
                          ) : (
                            <table className="tabla-detalle-items">
                              <thead>
                                <tr>
                                  <th>SKU</th>
                                  <th>Descripción</th>
                                  <th>Cant.</th>
                                  <th>Pallet</th>
                                  <th>Último movimiento</th>
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
                                        ? `${it.ultimoMovimiento.tipoMovimiento} · ${it.ultimoMovimiento.movidoPor} (${formatFechaMovimiento(it.ultimoMovimiento.fecha)})`
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
