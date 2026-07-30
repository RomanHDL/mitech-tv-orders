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
// No calcula surtido efectivo ni cambia cantidadSurtida/badges/estado —
// eso queda para un bloque posterior aprobado por separado. Sin polling
// todavía: carga al montar y refresca tras vincular/desvincular.
export default function PalletsVinculados({ pedidoId }) {
  const { t, i18n } = useTranslation()
  const [vinculados, setVinculados] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

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

  useEffect(() => {
    const cancelar = cargarVinculados()
    return cancelar
  }, [cargarVinculados])

  // Al cambiar de pedido (flechas anterior/siguiente del modal, sin
  // desmontar este componente) se limpia todo el estado de búsqueda y
  // acción — evita mostrar un resultado de búsqueda o un error que
  // pertenecían al pedido anterior. La lista de vinculados ya se
  // refresca sola arriba porque cargarVinculados depende de pedidoId.
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
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAccionando(false)
    }
  }

  return (
    <div className="pallets-vinculados">
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
