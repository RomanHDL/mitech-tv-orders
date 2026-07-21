'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconAlert, IconBox, IconCheckCircle, IconClipboardList, IconClock, IconRetry, IconScan } from '../components/icons'
import { ESTADO_LABEL } from '@/lib/catalogos'
import { diasHastaLimite, estaVencido } from '@/lib/estado-pedido'
import PanelSurtido from './panel-surtido'

function claseSimple(pct) {
  if (pct >= 100) return 'TERMINADO'
  if (pct > 0) return 'EN_PROCESO'
  return 'PENDIENTE'
}

function formatearFechaLimite(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

export default function SurtirListaCliente({ pedidos, metricas, rol }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [condicionFiltro, setCondicionFiltro] = useState('todos')
  const [vencimientoFiltro, setVencimientoFiltro] = useState('todos')
  const [verCompletados, setVerCompletados] = useState(false)
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [pedidoDetalle, setPedidoDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')

  const condicionesReales = useMemo(
    () => [...new Set(pedidos.flatMap((p) => p.condiciones))].sort(),
    [pedidos]
  )

  const activos = useMemo(() => pedidos.filter((p) => p.activo), [pedidos])
  const completados = useMemo(() => pedidos.filter((p) => !p.activo), [pedidos])
  const base = verCompletados ? [...activos, ...completados] : activos

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return base.filter((p) => {
      if (q) {
        const coincide =
          p.pedidoNombre.toLowerCase().includes(q) ||
          (p.numeroPedido || '').toLowerCase().includes(q)
        if (!coincide) return false
      }
      if (estadoFiltro !== 'todos' && claseSimple(p.pct) !== estadoFiltro) return false
      if (condicionFiltro !== 'todos' && !p.condiciones.includes(condicionFiltro)) return false
      if (vencimientoFiltro !== 'todos') {
        const dias = diasHastaLimite(p.fechaLimite)
        if (vencimientoFiltro === 'vencidos' && !estaVencido({ ...p, estadoOperativo: p.estadoOperativo })) return false
        if (vencimientoFiltro === 'hoy' && dias !== 0) return false
        if (vencimientoFiltro === 'proximos' && !(dias !== null && dias > 0 && dias <= 7)) return false
        if (vencimientoFiltro === 'sinfecha' && p.fechaLimite) return false
      }
      return true
    })
  }, [base, busqueda, estadoFiltro, condicionFiltro, vencimientoFiltro])

  const cargarDetalle = (id) => {
    setCargandoDetalle(true)
    setErrorDetalle('')
    fetch(`/api/pedidos/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar el pedido')
        return r.json()
      })
      .then((d) => setPedidoDetalle({ ...d, id: d._id }))
      .catch((err) => setErrorDetalle(err.message))
      .finally(() => setCargandoDetalle(false))
  }

  // Selecciona automáticamente el primer pedido visible si no hay ninguno
  // seleccionado, o si el seleccionado quedó fuera de los filtros actuales.
  useEffect(() => {
    if (filtrados.length === 0) {
      setSeleccionadoId(null)
      setPedidoDetalle(null)
      return
    }
    if (!filtrados.some((p) => p.id === seleccionadoId)) {
      setSeleccionadoId(filtrados[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados])

  useEffect(() => {
    if (seleccionadoId) cargarDetalle(seleccionadoId)
    else setPedidoDetalle(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId])

  function recargarTodo() {
    startTransition(() => router.refresh())
    if (seleccionadoId) cargarDetalle(seleccionadoId)
  }

  return (
    <main className="surtir-page">
      <div className="page-header">
        <h1>Surtir pedidos</h1>
        <p className="subtitle">Prepara, escanea y completa los pedidos activos.</p>
      </div>

      <div className="metricas-grid surtir-metricas">
        <div className="metrica-card metrica-activos">
          <span className="metrica-icono"><IconClipboardList /></span>
          <div>
            <div className="metrica-valor">{metricas.pedidosActivos}</div>
            <div className="metrica-titulo">Pedidos activos</div>
            <div className="metrica-desc">Con actividades en curso</div>
          </div>
        </div>
        <div className="metrica-card metrica-piezas-surtidas">
          <span className="metrica-icono"><IconBox /></span>
          <div>
            <div className="metrica-valor">{metricas.piezasSurtidasActivos}</div>
            <div className="metrica-titulo">Piezas surtidas en activos</div>
            <div className="metrica-desc">Total surtido en pedidos activos</div>
          </div>
        </div>
        <div className="metrica-card metrica-piezas-pendientes">
          <span className="metrica-icono"><IconClock /></span>
          <div>
            <div className="metrica-valor">{metricas.piezasPendientesActivos}</div>
            <div className="metrica-titulo">Piezas pendientes en activos</div>
            <div className="metrica-desc">Aún por surtir en pedidos activos</div>
          </div>
        </div>
        <div className="metrica-card metrica-completados-hoy">
          <span className="metrica-icono"><IconCheckCircle /></span>
          <div>
            <div className="metrica-valor">{metricas.completadosHoy}</div>
            <div className="metrica-titulo">Completados hoy</div>
            <div className="metrica-desc">Pedidos finalizados hoy</div>
          </div>
        </div>
      </div>

      <div className="card surtir-filtros">
        <div className="search-box surtir-buscador">
          <input
            type="text"
            placeholder="Buscar pedido, número o SKU…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="filtro-campo">
          <label>Estado</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="TERMINADO">Surtido terminado</option>
          </select>
        </div>
        <div className="filtro-campo">
          <label>Condición</label>
          <select value={condicionFiltro} onChange={(e) => setCondicionFiltro(e.target.value)}>
            <option value="todos">Todas</option>
            {condicionesReales.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filtro-campo">
          <label>Vencimiento</label>
          <select value={vencimientoFiltro} onChange={(e) => setVencimientoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="vencidos">Vencidos</option>
            <option value="hoy">Hoy</option>
            <option value="proximos">Próximos</option>
            <option value="sinfecha">Sin fecha límite</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" title="Escanear QR">
          <IconScan /> Escanear QR
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setVerCompletados((v) => !v)}>
          {verCompletados ? 'Ocultar completados' : `Mostrar completados (${completados.length})`}
        </button>
      </div>

      <div className="surtir-content">
        <div className="card surtir-panel-lista">
          <div className="surtir-lista-header">
            <h3>Pedidos por surtir</h3>
            <span className="badge-contador">{filtrados.length}</span>
          </div>

          {filtrados.length === 0 ? (
            <div className="empty">
              <IconClipboardList width={40} height={40} />
              <p>No hay pedidos que coincidan con los filtros.</p>
            </div>
          ) : (
            <div className="surtir-lista-tarjetas">
              {filtrados.map((p) => {
                const estadoSimple = claseSimple(p.pct)
                const seleccionado = p.id === seleccionadoId
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`surtir-tarjeta-pedido ${seleccionado ? 'seleccionada' : ''} vencimiento-${estaVencido({ ...p }) ? 'vencido' : 'normal'}`}
                    onClick={() => setSeleccionadoId(p.id)}
                  >
                    <div className="surtir-tarjeta-header">
                      <span className="surtir-tarjeta-numero">#{p.numeroPedido || p.id.slice(-6)}</span>
                      <div className="tags-celda">
                        {p.condiciones.map((c) => <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>)}
                      </div>
                    </div>
                    <div className="progreso-track surtir-tarjeta-track">
                      <div className={`progreso-fill ${estadoSimple === 'TERMINADO' ? 'completa' : ''}`} style={{ width: `${p.pct}%` }} />
                    </div>
                    <div className="surtir-tarjeta-cifras">
                      <span>{p.totalSurtido} de {p.totalRequerido} surtidas</span>
                      <span className="surtir-tarjeta-pendientes">{p.pendiente} pendientes</span>
                      <span className="surtir-tarjeta-pct">{p.pct}%</span>
                    </div>
                    <div className="surtir-tarjeta-footer">
                      {p.fechaLimite && (
                        <span className="chip-fecha-limite-mini">Límite: {formatearFechaLimite(p.fechaLimite)}</span>
                      )}
                      <span className={`badge-estado-op estado-${estadoSimple.toLowerCase().replace('_', '-')}`}>
                        {ESTADO_LABEL[estadoSimple]}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <p className="surtir-lista-resumen">Mostrando {filtrados.length} de {filtrados.length} pedidos</p>
        </div>

        <div className="surtir-panel-detalle-wrap">
          {!seleccionadoId ? (
            <div className="card panel-detalle-vacio">
              <IconClipboardList width={40} height={40} />
              <p>Selecciona un pedido para comenzar a surtirlo.</p>
            </div>
          ) : cargandoDetalle ? (
            <div className="card panel-surtido-skeleton">
              <div className="skeleton-linea" />
              <div className="skeleton-linea" />
              <div className="skeleton-bloque" />
            </div>
          ) : errorDetalle ? (
            <div className="card historial-tabla-vacio">
              <IconAlert width={32} height={32} />
              <p>{errorDetalle}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => cargarDetalle(seleccionadoId)}>
                <IconRetry /> Reintentar
              </button>
            </div>
          ) : pedidoDetalle ? (
            <PanelSurtido pedido={pedidoDetalle} rol={rol} onCambiado={recargarTodo} />
          ) : null}
        </div>
      </div>
    </main>
  )
}
