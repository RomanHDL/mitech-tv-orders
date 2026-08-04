'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconRetry } from '../components/icons'
import { formatearNumero } from '@/lib/intl-format'
import ConnectionStatus from './components/ConnectionStatus'
import LiveOrdersKpiCards from './components/LiveOrdersKpiCards'
import LiveOrdersFilters from './components/LiveOrdersFilters'
import LiveOrdersTable from './components/LiveOrdersTable'
import LiveOrderDetailModal from './components/LiveOrderDetailModal'

const POR_PAGINA_OPCIONES = [50, 100, 150, 200]
const INTERVALO_POLLING_MS = 20000
const INTERVALO_STATS_MS = 60000
const TIMEOUT_LISTADO_MS = 15000

const FILTROS_VACIOS = { estado: '', marketplace: '', cuenta: '', fecha: '', ubicacion: '' }

export default function PedidosLiveCliente({ titulo }) {
  const { t, i18n } = useTranslation()

  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(150)

  // null = todavía nunca se cargó con éxito (distingue de "cargó y vino vacío").
  const [pedidos, setPedidos] = useState(null)
  const [total, setTotal] = useState(0)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [actualizandoLista, setActualizandoLista] = useState(false)
  const [error, setError] = useState(null) // sin datos previos → error bloqueante
  const [avisoDesactualizado, setAvisoDesactualizado] = useState(null) // hay datos previos, el refresh falló
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)

  const [stats, setStats] = useState(null)
  const [opcionesFiltro, setOpcionesFiltro] = useState(null)
  const [detalleResumen, setDetalleResumen] = useState(null) // fila del pedido con el modal abierto, o null

  const abortListaRef = useRef(null)
  const abortStatsRef = useRef(null)
  const debounceRef = useRef(null)
  const pollingRef = useRef(null)
  const statsPollingRef = useRef(null)
  const cargaIdRef = useRef(0)
  const detalleCacheRef = useRef(new Map())

  const cargarPedidos = useCallback((busquedaActual, paginaActual, porPaginaActual, filtrosActuales) => {
    abortListaRef.current?.abort()
    const controller = new AbortController()
    abortListaRef.current = controller
    const miCargaId = ++cargaIdRef.current

    const timer = setTimeout(() => controller.abort(), TIMEOUT_LISTADO_MS)
    setActualizandoLista(true)

    const params = new URLSearchParams({ page: String(paginaActual), limit: String(porPaginaActual) })
    if (busquedaActual) params.set('search', busquedaActual)
    if (filtrosActuales.estado) params.set('estado', filtrosActuales.estado)
    if (filtrosActuales.marketplace) params.set('marketplace', filtrosActuales.marketplace)
    if (filtrosActuales.cuenta) params.set('cuenta', filtrosActuales.cuenta)
    if (filtrosActuales.fecha) params.set('fecha', filtrosActuales.fecha)
    if (filtrosActuales.ubicacion) params.set('ubicacion', filtrosActuales.ubicacion)

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
        setUltimaActualizacion(Date.now())
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
          setActualizandoLista(false)
        }
      })
  }, [t])

  const cargarStats = useCallback(() => {
    abortStatsRef.current?.abort()
    const controller = new AbortController()
    abortStatsRef.current = controller
    fetch('/api/live-orders/stats', { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) return null
        return data.data
      })
      .then((data) => {
        if (data) setStats(data)
      })
      .catch(() => {
        // KPIs no críticos — si falla, se conservan los últimos valores válidos.
      })
  }, [])

  // Carga inicial: lista, KPIs y opciones de filtro en paralelo.
  useEffect(() => {
    cargarPedidos('', 1, porPagina, FILTROS_VACIOS)
    cargarStats()
    fetch('/api/live-orders/filters', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setOpcionesFiltro(data.data)
      })
      .catch(() => {})
    return () => {
      abortListaRef.current?.abort()
      abortStatsRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Búsqueda con debounce — toda búsqueda nueva vuelve a la página 1.
  const primerRenderBusqueda = useRef(true)
  useEffect(() => {
    if (primerRenderBusqueda.current) {
      primerRenderBusqueda.current = false
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPagina(1)
      cargarPedidos(busqueda, 1, porPagina, filtros)
    }, 350)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // Cambio de filtros (selects) — inmediato, vuelve a página 1.
  const primerRenderFiltros = useRef(true)
  useEffect(() => {
    if (primerRenderFiltros.current) {
      primerRenderFiltros.current = false
      return
    }
    setPagina(1)
    cargarPedidos(busqueda, 1, porPagina, filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros])

  // Cambio de página o tamaño de página — inmediato, sin debounce.
  const primerRenderPagina = useRef(true)
  useEffect(() => {
    if (primerRenderPagina.current) {
      primerRenderPagina.current = false
      return
    }
    cargarPedidos(busqueda, pagina, porPagina, filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, porPagina])

  // Polling silencioso de la tabla — mantiene búsqueda/filtros/página.
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      cargarPedidos(busqueda, pagina, porPagina, filtros)
    }, INTERVALO_POLLING_MS)
    return () => clearInterval(pollingRef.current)
  }, [busqueda, pagina, porPagina, filtros, cargarPedidos])

  // Polling de KPIs — más lento porque cuenta TODO el dataset, no la página.
  useEffect(() => {
    statsPollingRef.current = setInterval(cargarStats, INTERVALO_STATS_MS)
    return () => clearInterval(statsPollingRef.current)
  }, [cargarStats])

  const reintentar = () => cargarPedidos(busqueda, pagina, porPagina, filtros)

  const onFiltroChange = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
  }
  const onLimpiarFiltros = () => {
    setBusqueda('')
    setFiltros(FILTROS_VACIOS)
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

  const pedidosVisibles = pedidos || []
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const totalGlobal = stats?.total ?? total
  const estadoConexion = actualizandoLista ? 'actualizando' : avisoDesactualizado ? 'sinConexion' : 'vivo'

  return (
    <>
      <div className="page-header live-orders-header">
        <div>
          <h1>{titulo}</h1>
          <p className="subtitle">
            {t('pedidosLive.subtituloPedidos', { count: totalGlobal, formattedCount: formatearNumero(totalGlobal, i18n.language) })}
          </p>
        </div>
        <ConnectionStatus estado={estadoConexion} ultimaActualizacion={ultimaActualizacion} />
      </div>

      <LiveOrdersKpiCards stats={stats} />

      <LiveOrdersFilters
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        filtros={filtros}
        onFiltroChange={onFiltroChange}
        onLimpiar={onLimpiarFiltros}
        opciones={opcionesFiltro}
      />

      <div className="card live-orders-tabla-card">
        {avisoDesactualizado && (
          <div className="alerta alerta-error">
            <span>{t('pedidosLive.noSePudoActualizar')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reintentar}>
              <IconRetry /> {t('common.reintentar')}
            </button>
          </div>
        )}

        <p className="live-orders-polling-hint">{t('pedidosLive.actualizacionAutomatica')}</p>

        {pedidosVisibles.length === 0 ? (
          <div className="empty">
            <p>{t('pedidosLive.sinResultados', { busqueda })}</p>
          </div>
        ) : (
          <LiveOrdersTable pedidos={pedidosVisibles} onVerDetalle={(orderId) => {
            const fila = pedidosVisibles.find((p) => p.orderId === orderId)
            if (fila) setDetalleResumen(fila)
          }} />
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

      {detalleResumen && (
        <LiveOrderDetailModal
          resumen={detalleResumen}
          onClose={() => setDetalleResumen(null)}
          cacheRef={detalleCacheRef}
        />
      )}
    </>
  )
}
