'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBox, IconRefresh, IconRetry, IconSearch } from '../components/icons'
import { localeDe } from '@/lib/intl-format'

const POR_PAGINA_OPCIONES = [50, 100, 150, 200]
const INTERVALO_POLLING_MS = 20000
const TIMEOUT_LISTADO_MS = 15000
const TIMEOUT_DETALLE_MS = 15000

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

function formatFecha(iso, lang) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(fecha)
}

export default function PedidosLiveCliente({ titulo }) {
  const { t, i18n } = useTranslation()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(150)
  // null = todavía nunca se cargó con éxito (distingue de "cargó y vino vacío").
  const [pedidos, setPedidos] = useState(null)
  const [total, setTotal] = useState(0)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState(null) // sin datos previos → error bloqueante
  const [avisoDesactualizado, setAvisoDesactualizado] = useState(null) // hay datos previos, el refresh falló

  const [abiertoId, setAbiertoId] = useState(null)
  const [detalle, setDetalle] = useState({}) // orderId -> { cargando, error, items }

  const abortListaRef = useRef(null)
  const debounceRef = useRef(null)
  const pollingRef = useRef(null)
  const cargaIdRef = useRef(0)
  const detalleAbortRef = useRef({}) // orderId -> AbortController

  const cargarPedidos = useCallback((busquedaActual, paginaActual, porPaginaActual) => {
    abortListaRef.current?.abort()
    const controller = new AbortController()
    abortListaRef.current = controller
    const miCargaId = ++cargaIdRef.current

    const timer = setTimeout(() => controller.abort(), TIMEOUT_LISTADO_MS)
    setActualizando(true)

    const params = new URLSearchParams({ page: String(paginaActual), limit: String(porPaginaActual) })
    if (busquedaActual) params.set('search', busquedaActual)

    fetch(`/api/live-orders?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) {
          throw new Error(data.error || t('pedidosLive.errorConexion'))
        }
        return data
      })
      .then((data) => {
        if (cargaIdRef.current !== miCargaId) return // respuesta obsoleta, se ignora
        setPedidos(data.data || [])
        setTotal(data.pagination?.total ?? 0)
        setError(null)
        setAvisoDesactualizado(null)
      })
      .catch((err) => {
        if (err.name === 'AbortError' || cargaIdRef.current !== miCargaId) return
        setPedidos((prev) => {
          if (prev === null) {
            setError(err.message)
          } else {
            setAvisoDesactualizado(err.message)
          }
          return prev
        })
      })
      .finally(() => {
        clearTimeout(timer)
        if (cargaIdRef.current === miCargaId) {
          setCargandoInicial(false)
          setActualizando(false)
        }
      })
  }, [t])

  // Carga inicial.
  useEffect(() => {
    cargarPedidos('', 1, porPagina)
    return () => abortListaRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Búsqueda con debounce — cancela la solicitud anterior automáticamente
  // (cargarPedidos aborta el fetch en curso antes de lanzar uno nuevo). Toda
  // búsqueda nueva vuelve a la página 1.
  const primerRenderBusqueda = useRef(true)
  useEffect(() => {
    if (primerRenderBusqueda.current) {
      primerRenderBusqueda.current = false
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPagina(1)
      cargarPedidos(busqueda, 1, porPagina)
    }, 350)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // Cambio de página o tamaño de página — carga inmediata (sin debounce).
  const primerRenderPagina = useRef(true)
  useEffect(() => {
    if (primerRenderPagina.current) {
      primerRenderPagina.current = false
      return
    }
    cargarPedidos(busqueda, pagina, porPagina)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, porPagina])

  // Actualización automática silenciosa — no reinicia el spinner central,
  // no borra los pedidos ya mostrados, y mantiene la búsqueda/página actual.
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      cargarPedidos(busqueda, pagina, porPagina)
    }, INTERVALO_POLLING_MS)
    return () => clearInterval(pollingRef.current)
  }, [busqueda, pagina, porPagina, cargarPedidos])

  const reintentar = () => cargarPedidos(busqueda, pagina, porPagina)

  const cargarDetalle = async (orderId) => {
    detalleAbortRef.current[orderId]?.abort()
    const controller = new AbortController()
    detalleAbortRef.current[orderId] = controller
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DETALLE_MS)

    setDetalle((prev) => ({ ...prev, [orderId]: { cargando: true } }))
    try {
      const res = await fetch(`/api/live-orders/${orderId}`, { signal: controller.signal, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error || t('pedidosLive.errorCargarDetalle'))
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, items: data.data?.items || [] } }))
    } catch (err) {
      if (err.name === 'AbortError') {
        setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, error: t('pedidosLive.errorCargarDetalle') } }))
        return
      }
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, error: err.message } }))
    } finally {
      clearTimeout(timer)
    }
  }

  const toggleDetalle = (orderId) => {
    if (abiertoId === orderId) {
      setAbiertoId(null)
      return
    }
    setAbiertoId(orderId)
    if (detalle[orderId] && !detalle[orderId].error) return // ya cargado, no reconsultar
    cargarDetalle(orderId)
  }

  // Carga inicial en curso, sin datos previos que mostrar todavía.
  if (cargandoInicial) {
    return (
      <>
        <div className="page-header">
          <h1>{titulo}</h1>
        </div>
        <div className="loading-screen">
          <div className="spinner" />
          <div>{t('common.cargando')}</div>
        </div>
      </>
    )
  }

  // Falló la carga inicial y nunca hubo datos que conservar en pantalla.
  if (error && pedidos === null) {
    return (
      <>
        <div className="page-header">
          <h1>{titulo}</h1>
          <p className="subtitle">{t('pedidosLive.subtituloError')}</p>
        </div>
        <div className="card">
          <div className="alerta alerta-error">
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={reintentar}>
            <IconRetry /> {t('common.reintentar')}
          </button>
        </div>
      </>
    )
  }

  const pedidosFiltrados = pedidos || []
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  return (
    <>
      <div className="page-header">
        <h1>{titulo}</h1>
        <p className="subtitle">
          {t('pedidosLive.subtituloPedidos', { count: total })}
          {actualizando && <span className="spinner-sm" aria-hidden="true" />}
        </p>
      </div>

      <div className="card">
        {avisoDesactualizado && (
          <div className="alerta alerta-error">
            <span>{t('pedidosLive.noSePudoActualizar')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reintentar}>
              <IconRetry /> {t('common.reintentar')}
            </button>
          </div>
        )}

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
                          <span className={`badge-estatus ${claseEstatus(p.estatus)}`}>
                            {p.estatus || t('pedidosLive.sinEstatus')}
                          </span>
                        </td>
                        <td data-label={t('pedidosLive.colTotal')}>
                          <span className="numero-grande">{formatMoneda(p.total, p.moneda, i18n.language)}</span>
                        </td>
                        <td data-label={t('pedidosLive.colFecha')}>{formatFecha(p.enteredDate, i18n.language)}</td>
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
                              <p className="detalle-error">
                                {d.error}{' '}
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => cargarDetalle(p.orderId)}>
                                  <IconRetry /> {t('common.reintentar')}
                                </button>
                              </p>
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
                                          ? `${it.ultimoMovimiento.tipoMovimiento} · ${it.ultimoMovimiento.movidoPor} (${formatFecha(it.ultimoMovimiento.fecha, i18n.language)})`
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

        {!error && total > 0 && (
          <div className="paginacion">
            <span className="paginacion-info">
              {t('historial.mostrandoRegistros', {
                desde: (pagina - 1) * porPagina + 1,
                hasta: Math.min(pagina * porPagina, total),
                total,
              })}
            </span>
            <div className="paginacion-botones">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(1)} disabled={pagina <= 1}>«</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1}>{t('pedidos.anterior')}</button>
              <span className="paginacion-actual">{t('pedidos.pagina', { actual: pagina, total: totalPaginas })}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}>{t('pedidos.siguiente')}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(totalPaginas)} disabled={pagina >= totalPaginas}>»</button>
            </div>
            <select
              className="select-por-pagina"
              value={porPagina}
              onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }}
            >
              {POR_PAGINA_OPCIONES.map((n) => <option key={n} value={n}>{t('historial.porPagina', { n })}</option>)}
            </select>
          </div>
        )}
      </div>
    </>
  )
}
