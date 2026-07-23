'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconClipboardList, IconClose, IconPrinter, IconRetry } from '../components/icons'
import { claseEvento, etiquetaEstado, formatearFechaHora } from './eventos-helpers'
import { detalleLabel, detalleSecundarioLabel } from '@/lib/eventos-labels'

const TIMELINE_COLAPSADA = 6

function tagClass(c) {
  return `tag tag-${c.toLowerCase()}`
}

export default function PanelDetalle({ pedidoId, onCerrar }) {
  const { t, i18n } = useTranslation()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!pedidoId) {
      setDatos(null)
      return
    }
    let cancelado = false
    setCargando(true)
    setError('')
    setExpandido(false)
    fetch(`/api/eventos/pedido/${pedidoId}`)
      .then((r) => {
        if (!r.ok) throw new Error(t('historial.errorCarga'))
        return r.json()
      })
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((err) => { if (!cancelado) setError(err.message) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [pedidoId, version])

  if (!pedidoId) {
    return (
      <div className="panel-detalle-historial panel-detalle-vacio">
        <IconClipboardList width={40} height={40} />
        <p>{t('historial.seleccionaEvento')}</p>
      </div>
    )
  }

  const eventosVisibles = datos?.eventos
    ? (expandido ? datos.eventos : datos.eventos.slice(0, TIMELINE_COLAPSADA))
    : []

  return (
    <div className="panel-detalle-historial" id="panel-detalle-imprimible">
      <div className="panel-detalle-header">
        <h3>
          {datos ? `${t('historial.colPedido')} ${datos.pedido.numeroPedido || '—'} — ${datos.pedido.pedidoNombre}` : t('common.cargando')}
        </h3>
        <button type="button" className="modal-close" onClick={onCerrar} aria-label={t('common.cerrar')}>
          <IconClose />
        </button>
      </div>

      {cargando && (
        <div className="panel-detalle-skeleton">
          <div className="skeleton-linea" />
          <div className="skeleton-linea" />
          <div className="skeleton-linea" />
          <div className="skeleton-bloque" />
        </div>
      )}

      {error && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVersion((v) => v + 1)}>
            <IconRetry /> {t('common.reintentar')}
          </button>
        </div>
      )}

      {datos && !cargando && !error && (
        <>
          <div className="panel-detalle-datos">
            <div className="dato-linea">
              <span className="dato-label">{t('historial.colUnidad')}</span>
              <span className="dato-valor">{datos.pedido.unidad}</span>
            </div>
            <div className="dato-linea">
              <span className="dato-label">{t('historial.dueno')}</span>
              <span className="dato-valor">{datos.pedido.creadoPorNombre || '—'}</span>
            </div>
            <div className="dato-linea">
              <span className="dato-label">{t('historial.condicion')}</span>
              <div className="tags-celda">
                {datos.pedido.condiciones.length > 0
                  ? datos.pedido.condiciones.map((c) => <span key={c} className={tagClass(c)}>{c}</span>)
                  : <span className="tag-empty">—</span>}
              </div>
            </div>
            <div className="dato-linea">
              <span className="dato-label">{t('historial.fechaCreacion')}</span>
              <span className="dato-valor">{formatearFechaHora(datos.pedido.fecha, i18n.language)}</span>
            </div>
            <div className="dato-linea">
              <span className="dato-label">{t('historial.estadoActual')}</span>
              <span className={`badge-estado-op estado-${datos.pedido.estado.toLowerCase().replace('_', '-')}`}>
                {etiquetaEstado(t, datos.pedido.estado)}
              </span>
            </div>

            <div className="panel-detalle-totales">
              <div>
                <span className="dato-label">{t('common.solicitado')}</span>
                <span className="dato-valor-grande">{datos.pedido.totalRequerido}</span>
              </div>
              <div>
                <span className="dato-label">{t('common.surtido')}</span>
                <span className="dato-valor-grande">{datos.pedido.totalSurtido}</span>
              </div>
              <div>
                <span className="dato-label">{t('common.pendiente')}</span>
                {datos.pedido.pendiente > 0
                  ? <span className="pill pill-pendiente">{datos.pedido.pendiente}</span>
                  : <span className="pill pill-completo">{t('common.completo')}</span>}
              </div>
            </div>
          </div>

          <h4 className="panel-detalle-timeline-titulo">{t('historial.lineaTiempo')}</h4>

          {datos.eventos.length === 0 ? (
            <p className="acordeon-vacio">{t('historial.sinMovimientos')}</p>
          ) : (
            <ul className="timeline">
              {eventosVisibles.map((e) => (
                <li key={e._id} className="timeline-item">
                  <span className={`timeline-punto ${claseEvento(e)}`} />
                  <div className="timeline-contenido">
                    <span className="timeline-fecha">{formatearFechaHora(e.creadoEn, i18n.language)}</span>
                    {e.estadoNuevo && (
                      <span className={`badge-estado-op estado-${e.estadoNuevo.toLowerCase().replace('_', '-')}`}>
                        {etiquetaEstado(t, e.estadoNuevo)}
                      </span>
                    )}
                    <strong className="timeline-titulo">{detalleLabel(t, e)}</strong>
                    {e.detalleSecundario && <p className="timeline-desc">{detalleSecundarioLabel(t, e)}</p>}
                    {e.usuarioNombre && <span className="timeline-usuario">{e.usuarioNombre}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="panel-detalle-acciones">
            {datos.eventos.length > TIMELINE_COLAPSADA && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpandido((v) => !v)}>
                {expandido ? t('historial.verMenos') : t('historial.verHistorialCompleto')}
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <IconPrinter /> {t('common.imprimir')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
