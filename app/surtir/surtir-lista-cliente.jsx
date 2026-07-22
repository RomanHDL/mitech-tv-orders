'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconBox, IconCheckCircle, IconClipboardList, IconClock, IconRetry } from '../components/icons'
import { estadoLabel } from '@/lib/catalogos'
import { diasHastaLimite, estaVencido } from '@/lib/estado-pedido'
import { localeDe } from '@/lib/intl-format'
import PanelSurtido from './panel-surtido'

function claseSimple(pct) {
  if (pct >= 100) return 'TERMINADO'
  if (pct > 0) return 'EN_PROCESO'
  return 'PENDIENTE'
}

function formatearFechaLimite(iso, lang) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

export default function SurtirListaCliente({ pedidos, metricas, rol }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [condicionFiltro, setCondicionFiltro] = useState('todos')
  const [vencimientoFiltro, setVencimientoFiltro] = useState('todos')
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [pedidoDetalle, setPedidoDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')

  const condicionesReales = useMemo(
    () => [...new Set(pedidos.flatMap((p) => p.condiciones))].sort(),
    [pedidos]
  )

  const activos = useMemo(() => pedidos.filter((p) => p.activo), [pedidos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return activos.filter((p) => {
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
  }, [activos, busqueda, estadoFiltro, condicionFiltro, vencimientoFiltro])

  const cargarDetalle = (id) => {
    setCargandoDetalle(true)
    setErrorDetalle('')
    fetch(`/api/pedidos/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(t('surtir.errorCargarPedido'))
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
        <h1>{t('surtir.titulo')}</h1>
        <p className="subtitle">{t('surtir.subtitulo')}</p>
      </div>

      <div className="metricas-grid surtir-metricas">
        <div className="metrica-card metrica-activos">
          <span className="metrica-icono"><IconClipboardList /></span>
          <div>
            <div className="metrica-valor">{metricas.pedidosActivos}</div>
            <div className="metrica-titulo">{t('surtir.statPedidosActivosTitulo')}</div>
            <div className="metrica-desc">{t('surtir.statPedidosActivosDesc')}</div>
          </div>
        </div>
        <div className="metrica-card metrica-piezas-surtidas">
          <span className="metrica-icono"><IconBox /></span>
          <div>
            <div className="metrica-valor">{metricas.piezasSurtidasActivos}</div>
            <div className="metrica-titulo">{t('surtir.statPiezasSurtidasTitulo')}</div>
            <div className="metrica-desc">{t('surtir.statPiezasSurtidasDesc')}</div>
          </div>
        </div>
        <div className="metrica-card metrica-piezas-pendientes">
          <span className="metrica-icono"><IconClock /></span>
          <div>
            <div className="metrica-valor">{metricas.piezasPendientesActivos}</div>
            <div className="metrica-titulo">{t('surtir.statPiezasPendientesTitulo')}</div>
            <div className="metrica-desc">{t('surtir.statPiezasPendientesDesc')}</div>
          </div>
        </div>
        <div className="metrica-card metrica-completados-hoy">
          <span className="metrica-icono"><IconCheckCircle /></span>
          <div>
            <div className="metrica-valor">{metricas.completadosHoy}</div>
            <div className="metrica-titulo">{t('surtir.statCompletadosHoyTitulo')}</div>
            <div className="metrica-desc">{t('surtir.statCompletadosHoyDesc')}</div>
          </div>
        </div>
      </div>

      <div className="card surtir-filtros">
        <div className="search-box surtir-buscador">
          <input
            type="text"
            placeholder={t('surtir.buscarPedidoPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="filtro-campo">
          <label>{t('historial.estado')}</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">{t('historial.todos')}</option>
            <option value="PENDIENTE">{estadoLabel(t, 'PENDIENTE')}</option>
            <option value="EN_PROCESO">{estadoLabel(t, 'EN_PROCESO')}</option>
            <option value="TERMINADO">{estadoLabel(t, 'TERMINADO')}</option>
          </select>
        </div>
        <div className="filtro-campo">
          <label>{t('historial.condicion')}</label>
          <select value={condicionFiltro} onChange={(e) => setCondicionFiltro(e.target.value)}>
            <option value="todos">{t('surtir.todasFem')}</option>
            {condicionesReales.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filtro-campo">
          <label>{t('surtir.vencimiento')}</label>
          <select value={vencimientoFiltro} onChange={(e) => setVencimientoFiltro(e.target.value)}>
            <option value="todos">{t('historial.todos')}</option>
            <option value="vencidos">{t('pedidos.vencidos')}</option>
            <option value="hoy">{t('historial.rangoHoy')}</option>
            <option value="proximos">{t('surtir.proximos')}</option>
            <option value="sinfecha">{t('surtir.sinFechaLimite')}</option>
          </select>
        </div>
      </div>

      <div className="surtir-content">
        <div className="card surtir-panel-lista">
          <div className="surtir-lista-header">
            <h3>{t('surtir.pedidosPorSurtir')}</h3>
            <span className="badge-contador">{filtrados.length}</span>
          </div>

          {filtrados.length === 0 ? (
            <div className="empty">
              <IconClipboardList width={40} height={40} />
              <p>{t('surtir.sinPedidosFiltro2')}</p>
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
                      <span>{t('surtir.deSurtidas', { surt: p.totalSurtido, req: p.totalRequerido })}</span>
                      <span className="surtir-tarjeta-pendientes">{t('surtir.pendientesTarjeta', { n: p.pendiente })}</span>
                      <span className="surtir-tarjeta-pct">{p.pct}%</span>
                    </div>
                    <div className="surtir-tarjeta-footer">
                      {p.fechaLimite && (
                        <span className="chip-fecha-limite-mini">{t('surtir.limiteFecha', { fecha: formatearFechaLimite(p.fechaLimite, i18n.language) })}</span>
                      )}
                      <span className={`badge-estado-op estado-${estadoSimple.toLowerCase().replace('_', '-')}`}>
                        {estadoLabel(t, estadoSimple)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <p className="surtir-lista-resumen">{t('surtir.mostrandoPedidos', { n: filtrados.length, total: filtrados.length })}</p>
        </div>

        <div className="surtir-panel-detalle-wrap">
          {!seleccionadoId ? (
            <div className="card panel-detalle-vacio">
              <IconClipboardList width={40} height={40} />
              <p>{t('surtir.seleccionaPedido')}</p>
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
                <IconRetry /> {t('common.reintentar')}
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
