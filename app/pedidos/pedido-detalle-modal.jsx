'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import ComentariosPedido from '../components/comentarios-pedido'
import PalletsVinculados from '../components/pallets-vinculados'
import StepperEtapas from './stepper-etapas'
import { estadoLabel } from '@/lib/catalogos'
import { localeDe } from '@/lib/intl-format'
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconClose,
  IconPrinter,
} from '../components/icons'

function tagClase(c) {
  return `tag tag-${c.toLowerCase()}`
}

function formatearFechaLimite(iso, lang) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

// Estado por partida — misma convención que la exportación a Excel de la lista.
// Devuelve un código estable (no traducido) — el llamador decide el texto.
function estadoPartida(tv) {
  const surt = tv.cantidadSurtida || 0
  if (tv.sinLimite) return surt > 0 ? 'parcial' : 'pendiente'
  const cant = tv.cantidad || 0
  if (surt >= cant && cant > 0) return 'completo'
  return surt > 0 ? 'parcial' : 'pendiente'
}

// Próxima etapa accionable desde el estado actual (null si no hay ninguna,
// ej. ya DESPACHADO). CANCELADO se maneja aparte con su propio botón.
function proximaEtapa(t, estado) {
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO') {
    return { destino: 'CARGANDO', label: t('pedidoDetalle.iniciarCarga') }
  }
  if (estado === 'CARGANDO') return { destino: 'LISTO_SALIDA', label: t('pedidoDetalle.marcarListoSalida') }
  if (estado === 'LISTO_SALIDA') return { destino: 'DESPACHADO', label: t('pedidoDetalle.confirmarDespachoBtn') }
  return null
}

export default function PedidoDetalleModal({
  resumen,
  posicion,
  total,
  rol,
  onClose,
  onAnterior,
  onSiguiente,
  onCambiado,
}) {
  const { t, i18n } = useTranslation()
  const [seccionAbierta, setSeccionAbierta] = useState('articulos')
  const [comentarios, setComentarios] = useState(null)
  const [cargandoComentarios, setCargandoComentarios] = useState(true)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const modalRef = useRef(null)

  const estado = resumen.estado || 'PENDIENTE'
  const puedeAvanzarEtapa = rol === 'admin' || rol === 'surtidor'
  const siguiente = proximaEtapa(t, estado)
  const puedeCancelar = estado !== 'DESPACHADO' && estado !== 'CANCELADO'

  async function avanzarEtapa(destino) {
    setErrorEstado('')
    let razon = null

    if (destino === 'DESPACHADO') {
      if (!confirm(t('pedidoDetalle.confirmarDespacho'))) return
      if (resumen.pendiente > 0) {
        if (rol !== 'admin') {
          setErrorEstado(t('pedidoDetalle.noDespacharPendiente'))
          return
        }
        razon = window.prompt(t('pedidoDetalle.razonDespachoPendiente'))
        if (!razon || !razon.trim()) return
      }
    }

    if (destino === 'CANCELADO') {
      if (!confirm(t('pedidoDetalle.confirmarCancelar'))) return
    }

    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/pedidos/${resumen.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: destino, razon }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('pedidoDetalle.errorCambiarEstado'))
      }
      onCambiado?.()
    } catch (err) {
      setErrorEstado(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  // El resumen que llega de la lista ya trae número/nombre/fecha/artículos —
  // pero no los comentarios (la lista no los necesita), así que se piden aparte.
  useEffect(() => {
    let cancelado = false
    setCargandoComentarios(true)
    setComentarios(null)
    fetch(`/api/pedidos/${resumen.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelado || !data) return
        setComentarios({
          texto: data.comentarios || '',
          actualizadoIso: data.comentariosActualizado || null,
          actualizadoPorNombre: data.comentariosActualizadoPorNombre || null,
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCargandoComentarios(false)
      })
    return () => { cancelado = true }
  }, [resumen.id])

  // Bloqueo de scroll del body con restauración de posición — mismo patrón
  // ya usado en el modal de changelog y en el proyecto FFT.
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      const enCampo = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') {
        onClose()
      } else if (!enCampo && e.key === 'ArrowLeft') {
        onAnterior()
      } else if (!enCampo && e.key === 'ArrowRight') {
        onSiguiente()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, onAnterior, onSiguiente])

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const toggleSeccion = (nombre) => {
    setSeccionAbierta((actual) => (actual === nombre ? '' : nombre))
  }

  const tvs = resumen.televisiones || []

  return (
    <div className="modal-overlay" onMouseDown={onOverlayClick}>
      <div className="modal modal-pedido-detalle" ref={modalRef}>
        <div className="modal-header">
          <div className="modal-pedido-titulo">
            <h2>{t('pedidoDetalle.pedidoPrefijo', { numero: resumen.numeroPedido || '—' })}</h2>
            <span className={`badge-estado-op estado-${estado.toLowerCase().replace('_', '-')}`}>
              {estadoLabel(t, estado)}
            </span>
          </div>

          <div className="modal-pedido-acciones">
            <Link
              href={`/pedidos/${resumen.id}/imprimir`}
              className="btn btn-secondary btn-sm"
              title={t('common.imprimir')}
            >
              <IconPrinter />
              {t('common.imprimir')}
            </Link>

            <div className="modal-pedido-nav">
              <button
                type="button"
                className="btn-icono"
                onClick={onAnterior}
                disabled={posicion <= 1}
                aria-label={t('pedidoDetalle.pedidoAnterior')}
                title={t('pedidoDetalle.pedidoAnterior')}
              >
                <IconArrowLeft />
              </button>
              <span className="modal-pedido-contador">{posicion}/{total}</span>
              <button
                type="button"
                className="btn-icono"
                onClick={onSiguiente}
                disabled={posicion >= total}
                aria-label={t('pedidoDetalle.pedidoSiguiente')}
                title={t('pedidoDetalle.pedidoSiguiente')}
              >
                <IconArrowRight />
              </button>
            </div>

            <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.cerrar')}>
              <IconClose />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="pedido-datos-generales">
            <div className="pedido-datos-col">
              <div className="dato-linea">
                <span className="dato-label">{t('historial.colPedido')}</span>
                <span className="dato-valor">{resumen.pedidoNombre}</span>
              </div>
              <div className="dato-linea">
                <span className="dato-label">{t('pedidoDetalle.responsable')}</span>
                <span className="dato-valor">{resumen.creadoPorNombre || '—'}</span>
              </div>
              <div className="dato-linea">
                <span className="dato-label">{t('pedidoForm.condiciones')}</span>
                <div className="tags-celda">
                  {resumen.condiciones.length > 0
                    ? resumen.condiciones.map((c) => <span key={c} className={tagClase(c)}>{c}</span>)
                    : <span className="tag-empty">—</span>}
                </div>
              </div>
            </div>

            <div className="pedido-datos-col">
              <div className="dato-linea">
                <span className="dato-label">{t('historial.fechaCreacion')}</span>
                <span className="dato-valor">{resumen.fechaFmt || '—'}</span>
              </div>
              <div className="dato-linea">
                <span className="dato-label">{t('pedidoForm.fechaLimite')}</span>
                <span className="dato-valor">{formatearFechaLimite(resumen.fechaLimite, i18n.language)}</span>
              </div>
            </div>

            <div className="pedido-datos-col pedido-datos-col-totales">
              <div className="dato-linea">
                <span className="dato-label">{t('common.solicitado')}</span>
                <span className="dato-valor dato-valor-grande">{resumen.totalTvs}</span>
              </div>
              <div className="dato-linea">
                <span className="dato-label">{t('common.surtido')}</span>
                <span className="dato-valor dato-valor-grande">{resumen.totalSurtido}</span>
              </div>
              <div className="dato-linea">
                <span className="dato-label">{t('common.pendiente')}</span>
                {resumen.pendiente > 0
                  ? <span className="pill pill-pendiente">{resumen.pendiente}</span>
                  : <span className="pill pill-completo">{t('common.completo')}</span>}
              </div>
            </div>
          </div>

          <div className="pedido-ciclo">
            <h3 className="pedido-ciclo-titulo">{t('pedidoDetalle.cicloTitulo')}</h3>
            <StepperEtapas estado={estado} />

            {puedeAvanzarEtapa && (siguiente || puedeCancelar) && (
              <div className="pedido-ciclo-acciones">
                {siguiente && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => avanzarEtapa(siguiente.destino)}
                    disabled={cambiandoEstado}
                  >
                    {siguiente.label}
                  </button>
                )}
                {puedeCancelar && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => avanzarEtapa('CANCELADO')}
                    disabled={cambiandoEstado}
                  >
                    {t('pedidoDetalle.cancelarPedido')}
                  </button>
                )}
              </div>
            )}

            {errorEstado && (
              <div className="alerta alerta-error">
                <span>{errorEstado}</span>
              </div>
            )}

            {resumen.historialEstados && resumen.historialEstados.length > 0 && (
              <ul className="pedido-ciclo-historial">
                {resumen.historialEstados.map((h, i) => (
                  <li key={i}>
                    <strong>{estadoLabel(t, h.estadoNuevo)}</strong>
                    {' — '}
                    {h.usuarioNombre || t('pedidoDetalle.usuarioDesconocido')}
                    {h.observacion ? ` · ${h.observacion}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="acordeon">
            <button
              type="button"
              className={`acordeon-franja acordeon-franja-articulos ${seccionAbierta === 'articulos' ? 'abierta' : ''}`}
              onClick={() => toggleSeccion('articulos')}
            >
              <span className="acordeon-titulo">{t('pedidoDetalle.seccionArticulos', { n: tvs.length })}</span>
              <span className="acordeon-simbolo">
                <IconChevronDown className={seccionAbierta === 'articulos' ? 'rotado' : ''} />
              </span>
            </button>
            {seccionAbierta === 'articulos' && (
              <div className="acordeon-contenido">
                {tvs.length === 0 ? (
                  <p className="acordeon-vacio">{t('pedidoDetalle.sinArticulos')}</p>
                ) : (
                  <div className="tabla-wrap">
                    <table className="tabla-pedidos tabla-pedidos-densa tabla-items-modal">
                      <thead>
                        <tr>
                          <th>{t('pedidoDetalle.colSku')}</th>
                          <th>{t('pedidoForm.condicion')}</th>
                          <th>{t('pedidoDetalle.colSolicitada')}</th>
                          <th>{t('pedidoDetalle.colSurtida')}</th>
                          <th>{t('common.pendiente')}</th>
                          <th>%</th>
                          <th>{t('pedidoDetalle.colEstado')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tvs.map((tv, i) => {
                          const surt = tv.cantidadSurtida || 0
                          const pendiente = tv.sinLimite ? null : Math.max(0, (tv.cantidad || 0) - surt)
                          const pct = tv.sinLimite
                            ? null
                            : (tv.cantidad > 0 ? Math.round((surt / tv.cantidad) * 100) : 0)
                          const estadoFila = estadoPartida(tv)
                          return (
                            <tr key={i}>
                              <td data-label={t('pedidoDetalle.colSku')}>
                                <span className="sku-celda">
                                  {tv.marca} {tv.pulgadas}″ {tv.modelo}
                                </span>
                                {tv.modelosAlternativos?.length > 0 && (
                                  <div className="tv-alt-hint">
                                    {t('common.tambienValido', { lista: tv.modelosAlternativos.join(', ') })}
                                  </div>
                                )}
                              </td>
                              <td data-label={t('pedidoForm.condicion')}>
                                <div className="tags-celda">
                                  {(tv.condiciones || []).map((c) => (
                                    <span key={c} className={tagClase(c)}>{c}</span>
                                  ))}
                                </div>
                              </td>
                              <td data-label={t('pedidoDetalle.colSolicitada')}>
                                {tv.sinLimite ? t('pedidoForm.sinLimite') : tv.cantidad}
                              </td>
                              <td data-label={t('pedidoDetalle.colSurtida')}>{surt}</td>
                              <td data-label={t('common.pendiente')}>
                                {pendiente === null ? '—' : pendiente}
                              </td>
                              <td data-label="%">{pct === null ? '—' : `${pct}%`}</td>
                              <td data-label={t('pedidoDetalle.colEstado')}>
                                <span className={`badge-progreso ${estadoFila}`}>
                                  {t(`common.${estadoFila}`)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="acordeon">
            <button
              type="button"
              className={`acordeon-franja acordeon-franja-comentarios ${seccionAbierta === 'comentarios' ? 'abierta' : ''}`}
              onClick={() => toggleSeccion('comentarios')}
            >
              <span className="acordeon-titulo">{t('pedidoDetalle.seccionComentarios')}</span>
              <span className="acordeon-simbolo">
                <IconChevronDown className={seccionAbierta === 'comentarios' ? 'rotado' : ''} />
              </span>
            </button>
            {seccionAbierta === 'comentarios' && (
              <div className="acordeon-contenido">
                {cargandoComentarios ? (
                  <p className="acordeon-vacio">{t('pedidoDetalle.cargandoComentarios')}</p>
                ) : (
                  <ComentariosPedido
                    pedidoId={resumen.id}
                    comentariosIniciales={comentarios?.texto || ''}
                    actualizadoIso={comentarios?.actualizadoIso || null}
                    actualizadoPorNombre={comentarios?.actualizadoPorNombre || null}
                  />
                )}
              </div>
            )}
          </div>

          <div className="acordeon">
            <button
              type="button"
              className={`acordeon-franja acordeon-franja-pallets ${seccionAbierta === 'pallets' ? 'abierta' : ''}`}
              onClick={() => toggleSeccion('pallets')}
            >
              <span className="acordeon-titulo">{t('pedidoDetalle.seccionPallets')}</span>
              <span className="acordeon-simbolo">
                <IconChevronDown className={seccionAbierta === 'pallets' ? 'rotado' : ''} />
              </span>
            </button>
            {seccionAbierta === 'pallets' && (
              <div className="acordeon-contenido">
                <PalletsVinculados pedidoId={resumen.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
