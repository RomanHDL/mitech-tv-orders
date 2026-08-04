'use client'

import { useTranslation } from 'react-i18next'
import { formatFecha } from '../format'
import DetailEmptyState from './DetailEmptyState'

// pallets: mismo array del detalle — cada uno trae, cuando existe,
// ultimoMovimiento real (tipoMovimiento/movidoPor/fecha) reportado por la
// API de pallets del WMS. No se generan pasos de ciclo de vida ficticios
// ("pedido creado", "asignado para surtido", etc.) — solo movimientos que
// el WMS realmente reportó.
export default function OrderMovementTimeline({ pallets }) {
  const { t, i18n } = useTranslation()

  const eventos = pallets
    .filter((p) => p.ultimoMovimiento)
    .map((p) => ({ palletId: p.palletId, ...p.ultimoMovimiento }))
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))

  return (
    <div className="live-detalle-seccion">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.distribucionMovimiento')}</h3>
      {eventos.length === 0 ? (
        <DetailEmptyState mensaje={t('pedidosLive.detalle.sinMovimientos')} />
      ) : (
        <ul className="timeline">
          {eventos.map((ev, i) => (
            <li className="timeline-item" key={`${ev.palletId}-${i}`}>
              <span className="timeline-punto evt-proceso" />
              <div className="timeline-contenido">
                <span className="timeline-fecha">{formatFecha(ev.fecha, i18n.language)}</span>
                <span className="timeline-titulo">{ev.tipoMovimiento || t('pedidosLive.detalle.movimientoSinTipo')}</span>
                <p className="timeline-desc">{t('pedidosLive.detalle.pallet')} {ev.palletId}</p>
                {ev.movidoPor && <span className="timeline-usuario">{ev.movidoPor}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
