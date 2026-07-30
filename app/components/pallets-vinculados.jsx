'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localeDe } from '@/lib/intl-format'
import { IconAlert } from './icons'

function tagClase(c) {
  return `tag tag-${String(c || '').toLowerCase()}`
}

function fmtFecha(iso, lang = 'es-MX') {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(localeDe(lang), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Mexico_City',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

// Sección aditiva "Pallets vinculados" del detalle de pedido. Solo lectura
// contra la API propia de Pedidos — nunca llama a Cubicaje directamente.
// El progreso sincronizado (Bloque 3) es puramente informativo: nunca
// cambia cantidadSurtida, badges ni estadoOperativo. Sin polling todavía:
// carga al montar, y se recarga tras vincular/desvincular o al cambiar de
// pedido (flechas del modal).
export default function PalletsVinculados({ pedidoId }) {
  const { t, i18n } = useTranslation()
  const [vinculados, setVinculados] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [progreso, setProgreso] = useState(null)
  const [cargandoProgreso, setCargandoProgreso] = useState(true)
  const [errorProgreso, setErrorProgreso] = useState('')

  const [busquedaPalletId, setBusquedaPalletId] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  const [accionando, setAccionando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarVinculados = useCallback(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga('')
    fetch(`/api/pedidos/${pedidoId}/pallets`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        if (cancelado) return
        setVinculados(Array.isArray(data.vinculados) ? data.vinculados : [])
      })
      .catch(() => {
        if (!cancelado) setErrorCarga(t('palletsVinculados.errorBuscar'))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => { cancelado = true }
  }, [pedidoId, t])

  const cargarProgreso = useCallback(() => {
    let cancelado = false
    setCargandoProgreso(true)
    setErrorProgreso('')
    fetch(`/api/pedidos/${pedidoId}/pallets/progreso`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        if (cancelado) return
        setProgreso(data)
      })
      .catch(() => {
        if (!cancelado) setErrorProgreso(t('palletsVinculados.errorProgreso'))
      })
      .finally(() => {
        if (!cancelado) setCargandoProgreso(false)
      })
    return () => { cancelado = true }
  }, [pedidoId, t])

  useEffect(() => {
    const cancelar = cargarVinculados()
    return cancelar
  }, [cargarVinculados])

  useEffect(() => {
    const cancelar = cargarProgreso()
    return cancelar
  }, [cargarProgreso])

  // Al cambiar de pedido (flechas anterior/siguiente del modal, sin
  // desmontar este componente) se limpia todo el estado de búsqueda y
  // acción — evita mostrar un resultado de búsqueda o un error que
  // pertenecían al pedido anterior. La lista de vinculados y el progreso
  // ya se refrescan solos arriba porque sus callbacks dependen de pedidoId.
  useEffect(() => {
    setBusquedaPalletId('')
    setBuscando(false)
    setResultadoBusqueda(null)
    setErrorBusqueda('')
    setAccionando(false)
    setErrorAccion('')
  }, [pedidoId])

  async function buscarPallet(e) {
    e.preventDefault()
    const palletId = busquedaPalletId.trim()
    if (!palletId) return
    setBuscando(true)
    setErrorBusqueda('')
    setResultadoBusqueda(null)
    try {
      const res = await fetch(`/api/cubicaje-pallets/${encodeURIComponent(palletId)}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error(t('palletsVinculados.noEncontrado'))
        throw new Error(t('palletsVinculados.errorBuscar'))
      }
      const data = await res.json()
      setResultadoBusqueda(data)
    } catch (err) {
      setErrorBusqueda(err.message)
    } finally {
      setBuscando(false)
    }
  }

  async function vincular(palletId) {
    if (!confirm(t('palletsVinculados.confirmarVincular', { palletId }))) return
    setAccionando(true)
    setErrorAccion('')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/pallets/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palletId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('palletsVinculados.errorVincular'))
      setBusquedaPalletId('')
      setResultadoBusqueda(null)
      cargarVinculados()
      cargarProgreso()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAccionando(false)
    }
  }

  async function desvincular(palletId) {
    if (!confirm(t('palletsVinculados.confirmarDesvincular', { palletId }))) return
    const motivo = window.prompt(t('palletsVinculados.motivoDesvincular')) || null
    setAccionando(true)
    setErrorAccion('')
    try {
      const res = await fetch(
        `/api/pedidos/${pedidoId}/pallets/${encodeURIComponent(palletId)}/desvincular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('palletsVinculados.errorDesvincular'))
      cargarVinculados()
      cargarProgreso()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAccionando(false)
    }
  }

  const resumen = progreso?.resumen || null

  return (
    <div className="pallets-vinculados">
      {cargandoProgreso ? (
        <p className="acordeon-vacio">{t('palletsVinculados.cargandoProgreso')}</p>
      ) : errorProgreso ? (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{errorProgreso}</span>
        </div>
      ) : resumen ? (
        <div className="progreso-resumen">
          <div className="progreso-tiles">
            <div className="progreso-tile">
              <span className="progreso-tile-label">{t('palletsVinculados.surtidoManual')}</span>
              <span className="progreso-tile-valor">{resumen.cantidadSurtidaManual}</span>
            </div>
            <div className="progreso-tile">
              <span className="progreso-tile-label">{t('palletsVinculados.surtidoSincronizadoValido')}</span>
              <span className="progreso-tile-valor">{resumen.cantidadSincronizadaValida}</span>
            </div>
            <div className="progreso-tile progreso-tile-destacado">
              <span className="progreso-tile-label">{t('palletsVinculados.surtidoEfectivo')}</span>
              <span className="progreso-tile-valor">{resumen.surtidoEfectivo}</span>
            </div>
            <div className="progreso-tile">
              <span className="progreso-tile-label">{t('palletsVinculados.pendientes')}</span>
              <span className="progreso-tile-valor">{resumen.cantidadPendiente}</span>
            </div>
            <div className="progreso-tile">
              <span className="progreso-tile-label">{t('palletsVinculados.porcentajeEfectivo')}</span>
              <span className="progreso-tile-valor">{resumen.porcentajeEfectivo}%</span>
            </div>
            <div className="progreso-tile">
              <span className="progreso-tile-label">{t('palletsVinculados.palletsVinculadosCantidad')}</span>
              <span className="progreso-tile-valor">{resumen.palletsVinculados}</span>
            </div>
            {resumen.cantidadConDiscrepancia > 0 && (
              <div className="progreso-tile progreso-tile-alerta">
                <span className="progreso-tile-label">{t('palletsVinculados.piezasConDiscrepancia')}</span>
                <span className="progreso-tile-valor">{resumen.cantidadConDiscrepancia}</span>
              </div>
            )}
          </div>

          {Array.isArray(progreso.lineas) && progreso.lineas.length > 0 && (
            <div className="tabla-wrap">
              <table className="tabla-pedidos tabla-pedidos-densa tabla-items-modal">
                <caption className="progreso-detalle-titulo">{t('palletsVinculados.detalleLineasTitulo')}</caption>
                <thead>
                  <tr>
                    <th>{t('palletsVinculados.colModelo')}</th>
                    <th>{t('pedidoForm.condicion')}</th>
                    <th>{t('palletsVinculados.colSolicitadas')}</th>
                    <th>{t('palletsVinculados.colManuales')}</th>
                    <th>{t('palletsVinculados.colSincronizadasValidas')}</th>
                    <th>{t('palletsVinculados.colEfectivas')}</th>
                    <th>{t('palletsVinculados.colPendientes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {progreso.lineas.map((l) => (
                    <tr key={l.indice}>
                      <td data-label={t('palletsVinculados.colModelo')}>{l.modelo}</td>
                      <td data-label={t('pedidoForm.condicion')}>
                        <div className="tags-celda">
                          {(l.condiciones || []).map((c) => (
                            <span key={c} className={tagClase(c)}>{c}</span>
                          ))}
                        </div>
                      </td>
                      <td data-label={t('palletsVinculados.colSolicitadas')}>
                        {l.cantidadSolicitada === null ? t('pedidoForm.sinLimite') : l.cantidadSolicitada}
                      </td>
                      <td data-label={t('palletsVinculados.colManuales')}>{l.cantidadSurtidaManual}</td>
                      <td data-label={t('palletsVinculados.colSincronizadasValidas')}>{l.cantidadSincronizadaValida}</td>
                      <td data-label={t('palletsVinculados.colEfectivas')}>{l.surtidoEfectivo}</td>
                      <td data-label={t('palletsVinculados.colPendientes')}>
                        {l.cantidadPendiente === null ? '—' : l.cantidadPendiente}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Array.isArray(progreso.discrepancias) && progreso.discrepancias.length > 0 && (
            <div className="alerta alerta-error pallet-discrepancias">
              <IconAlert />
              <div>
                <strong>{t('palletsVinculados.discrepanciasTitulo')}</strong>
                <ul>
                  {progreso.discrepancias.map((d, i) => (
                    <li key={i}>
                      {d.motivo === 'sin_condicion'
                        ? t('palletsVinculados.discrepanciaSinCondicion', { sku: d.sku })
                        : d.motivo === 'cantidad_excedente'
                        ? t('palletsVinculados.discrepanciaCantidadExcedente', { sku: d.sku, condicion: d.condicion, cantidad: d.cantidad })
                        : t('palletsVinculados.discrepanciaNoSolicitado', { sku: d.sku, condicion: d.condicion })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <form className="pallets-buscador" onSubmit={buscarPallet}>
        <input
          type="text"
          value={busquedaPalletId}
          onChange={(e) => setBusquedaPalletId(e.target.value)}
          placeholder={t('palletsVinculados.buscarPlaceholder')}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={buscando || !busquedaPalletId.trim()}>
          {buscando ? t('palletsVinculados.buscando') : t('palletsVinculados.buscarBoton')}
        </button>
      </form>

      {errorBusqueda && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{errorBusqueda}</span>
        </div>
      )}

      {resultadoBusqueda && (
        <div className="pallet-preview">
          <div className="pallet-preview-header">
            <strong>{resultadoBusqueda.palletId}</strong>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={accionando}
              onClick={() => vincular(resultadoBusqueda.palletId)}
            >
              {t('palletsVinculados.vincularBoton')}
            </button>
          </div>
          <div className="pallet-preview-datos">
            <span>{t('palletsVinculados.cantidadTotal')}: {resultadoBusqueda.cantidadTotal ?? '—'}</span>
            <span>{t('palletsVinculados.ubicacion')}: {resultadoBusqueda.ubicacion ?? '—'}</span>
            <span>{t('palletsVinculados.operador')}: {resultadoBusqueda.operador ?? '—'}</span>
          </div>
          {Array.isArray(resultadoBusqueda.productos) && resultadoBusqueda.productos.length > 0 && (
            <div className="tags-celda">
              {resultadoBusqueda.productos.map((p, i) => (
                <span key={i} className={tagClase(p.condicion)}>
                  {p.sku} × {p.cantidad}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {errorAccion && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{errorAccion}</span>
        </div>
      )}

      {cargando ? (
        <p className="acordeon-vacio">{t('palletsVinculados.cargando')}</p>
      ) : errorCarga ? (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{errorCarga}</span>
        </div>
      ) : !vinculados || vinculados.length === 0 ? (
        <p className="acordeon-vacio">{t('palletsVinculados.sinPallets')}</p>
      ) : (
        <ul className="pallets-lista">
          {vinculados.map((v) => (
            <li key={v.palletId} className="pallet-vinculado-item">
              <div className="pallet-vinculado-header">
                <strong>{v.palletId}</strong>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={accionando}
                  onClick={() => desvincular(v.palletId)}
                >
                  {t('palletsVinculados.desvincularBoton')}
                </button>
              </div>
              <div className="pallet-preview-datos">
                <span>{t('palletsVinculados.cantidadTotal')}: {v.cantidadTotal ?? '—'}</span>
                <span>{t('palletsVinculados.ubicacion')}: {v.ubicacion ?? '—'}</span>
                <span>{t('palletsVinculados.operador')}: {v.operador ?? '—'}</span>
              </div>
              {Array.isArray(v.productos) && v.productos.length > 0 && (
                <div className="tags-celda">
                  {v.productos.map((p, i) => (
                    <span key={i} className={tagClase(p.condicion)}>
                      {p.sku} × {p.cantidad}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(v.discrepancias) && v.discrepancias.length > 0 && (
                <div className="alerta alerta-error pallet-discrepancias">
                  <IconAlert />
                  <div>
                    <strong>{t('palletsVinculados.discrepanciasTitulo')}</strong>
                    <ul>
                      {v.discrepancias.map((d, i) => (
                        <li key={i}>
                          {t('palletsVinculados.discrepanciaNoSolicitado', { sku: d.sku, condicion: d.condicion })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {v.vinculadoEn && (
                <span className="pallet-vinculado-meta">
                  {t('palletsVinculados.vinculadoPor', {
                    nombre: v.vinculadoPorNombre || t('pedidoDetalle.usuarioDesconocido'),
                    fecha: fmtFecha(v.vinculadoEn, i18n.language),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
