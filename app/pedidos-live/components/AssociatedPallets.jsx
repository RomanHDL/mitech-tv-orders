'use client'

import { useTranslation } from 'react-i18next'
import { formatFecha } from '../format'
import DetailEmptyState from './DetailEmptyState'

// pallets: [{ palletId, piezas, ubicacion, condiciones, cantidadTotal, ultimoMovimiento }]
export default function AssociatedPallets({ pallets }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="live-detalle-seccion live-detalle-seccion-mitad">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.palletsAsociados')}</h3>
      {pallets.length === 0 ? (
        <DetailEmptyState mensaje={t('pedidosLive.detalle.sinPallets')} />
      ) : (
        <div className="pallets-asociados-lista">
          {pallets.map((p) => (
            <div key={p.palletId} className="pallet-asociado-card">
              <div className="pallet-asociado-titulo">{p.palletId}</div>
              <div className="pallet-asociado-datos">
                <span>{t('pedidosLive.detalle.piezas', { count: p.piezas, n: p.piezas })}</span>
                {p.ubicacion && <span>{p.ubicacion}</span>}
                {p.condiciones && <span>{p.condiciones}</span>}
              </div>
              {p.ultimoMovimiento && (
                <div className="pallet-asociado-movimiento">
                  {p.ultimoMovimiento.tipoMovimiento} · {p.ultimoMovimiento.movidoPor} · {formatFecha(p.ultimoMovimiento.fecha, i18n.language)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
