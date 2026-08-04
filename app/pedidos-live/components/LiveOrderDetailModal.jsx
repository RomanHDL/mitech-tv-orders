'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconRefresh, IconRetry } from '../../components/icons'
import { bucketDeEstatus } from '../estatus'
import OrderGeneralInfo from './OrderGeneralInfo'
import OrderOperationalSummary from './OrderOperationalSummary'
import OrderItemsTable from './OrderItemsTable'
import AssociatedPallets from './AssociatedPallets'
import BulkTelevisions from './BulkTelevisions'
import OrderMovementTimeline from './OrderMovementTimeline'
import OrderEvidenceGallery from './OrderEvidenceGallery'

const TIMEOUT_DETALLE_MS = 15000
const FOCABLES_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// resumen: fila de la lista (ya trae webOrderId/source/estatus/accountName/
// cliente/total/moneda/enteredDate/ubicacion) — permite pintar el
// encabezado y "Datos generales" de inmediato, sin esperar el detalle.
// cacheRef: Map compartido con el orquestador (orderId -> datos) para que
// reabrir el mismo pedido sea instantáneo; "Actualizar" siempre refresca.
export default function LiveOrderDetailModal({ resumen, onClose, cacheRef }) {
  const { t, i18n } = useTranslation()
  const cacheado = cacheRef.current.get(resumen.orderId) || null

  const [datos, setDatos] = useState(cacheado)
  const [cargando, setCargando] = useState(!cacheado)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState(null)
  const [avisoError, setAvisoError] = useState(null)

  const abortRef = useRef(null)
  const tieneDatosRef = useRef(!!cacheado)
  const modalRef = useRef(null)

  const cargar = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DETALLE_MS)
    if (tieneDatosRef.current) setActualizando(true)
    else setCargando(true)

    fetch(`/api/live-orders/${resumen.orderId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.success === false) throw new Error(data.error || t('pedidosLive.errorCargarDetalle'))
        return data
      })
      .then((data) => {
        const nuevo = {
          items: data.data?.items || [],
          pallets: data.data?.pallets || [],
          granel: data.data?.granel || [],
          updatedAt: data.updatedAt || null,
        }
        cacheRef.current.set(resumen.orderId, nuevo)
        tieneDatosRef.current = true
        setDatos(nuevo)
        setError(null)
        setAvisoError(null)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (tieneDatosRef.current) setAvisoError(err.message)
        else setError(err.message)
      })
      .finally(() => {
        clearTimeout(timer)
        setCargando(false)
        setActualizando(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen.orderId])

  useEffect(() => {
    cargar()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen.orderId])

  // Bloqueo de scroll del body + foco atrapado + Escape — mismo patrón que
  // app/pedidos/pedido-detalle-modal.jsx, con trampa de Tab agregada porque
  // ese modal no la necesitaba (este sí, por accesibilidad §).
  useEffect(() => {
    const previamenteEnfocado = document.activeElement
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    const primerFocable = modalRef.current?.querySelector(FOCABLES_SELECTOR)
    primerFocable?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focables = modalRef.current.querySelectorAll(FOCABLES_SELECTOR)
      if (focables.length === 0) return
      const primero = focables[0]
      const ultimo = focables[focables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
      previamenteEnfocado?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  const onOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const bucket = bucketDeEstatus(resumen.estatus)
  const tituloId = `live-order-modal-titulo-${resumen.orderId}`

  return (
    <div className="modal-overlay" onMouseDown={onOverlayMouseDown}>
      <div
        className="modal modal-live-order-detalle"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        ref={modalRef}
      >
        <div className="modal-header">
          <div className="modal-pedido-titulo">
            <h2 id={tituloId}>{t('pedidosLive.detalle.pedidoPrefijo', { numero: resumen.orderId })}</h2>
          </div>
          <div className="modal-pedido-acciones">
            <button
              type="button"
              className="btn-icono"
              onClick={cargar}
              disabled={actualizando}
              aria-label={t('common.reintentar')}
              title={t('common.reintentar')}
            >
              {actualizando ? <span className="spinner-sm" aria-hidden="true" /> : <IconRefresh />}
            </button>
            <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.cerrar')}>
              <IconClose />
            </button>
          </div>
        </div>

        <div className="live-detalle-subheader">
          {resumen.webOrderId && <span>{resumen.webOrderId}</span>}
          {resumen.source && <span>{resumen.source}</span>}
          <span className={`badge-estatus ${bucket}`}>{resumen.estatus || t('pedidosLive.sinEstatus')}</span>
        </div>

        <div className="modal-body">
          {avisoError && (
            <div className="alerta alerta-error live-detalle-aviso">
              <span>{t('pedidosLive.noSePudoActualizar')}</span>
            </div>
          )}

          {cargando ? (
            <div className="live-detalle-skeleton" aria-hidden="true">
              <div className="skeleton-linea skeleton-ancho-70" />
              <div className="skeleton-linea skeleton-ancho-40" />
              <div className="skeleton-bloque" />
              <div className="skeleton-bloque" />
            </div>
          ) : error && !datos ? (
            <div className="live-detalle-error">
              <p>{t('pedidosLive.detalle.errorCargarDetalle')}</p>
              <div className="live-detalle-error-acciones">
                <button type="button" className="btn btn-primary" onClick={cargar}>
                  <IconRetry /> {t('common.reintentar')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('common.cerrar')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <OrderGeneralInfo resumen={resumen} actualizadoEn={datos?.updatedAt} />
              <OrderOperationalSummary
                items={datos?.items || []}
                pallets={datos?.pallets || []}
                granel={datos?.granel || []}
                bucket={bucket}
              />
              <OrderItemsTable items={datos?.items || []} />
              <div className="live-detalle-fila-mitad">
                <AssociatedPallets pallets={datos?.pallets || []} />
                <BulkTelevisions granel={datos?.granel || []} />
              </div>
              <OrderMovementTimeline pallets={datos?.pallets || []} />
              <OrderEvidenceGallery />
            </>
          )}
        </div>

        <div className="modal-footer live-detalle-footer">
          <div />
          <div className="live-detalle-footer-acciones">
            <button type="button" className="btn btn-secondary" onClick={cargar} disabled={actualizando}>
              {actualizando && <span className="spinner-sm" aria-hidden="true" />}
              {t('pedidosLive.detalle.actualizar')}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.cerrar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
