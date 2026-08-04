'use client'

import { useTranslation } from 'react-i18next'
import DetailEmptyState from './DetailEmptyState'

// granel: [{ orderItemsId, sku, itemDescription, qty, amount }] — items sin
// BinID asignado todavía. El WMS (OM.OrderItems/BM.Bins) no expone marca,
// modelo, pulgadas, condición ni LPN a este nivel — no se inventan, se
// documenta la limitación en vez de rellenar con guiones por columna.
export default function BulkTelevisions({ granel }) {
  const { t } = useTranslation()

  return (
    <div className="live-detalle-seccion live-detalle-seccion-mitad">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.tvsGranel')}</h3>
      {granel.length === 0 ? (
        <DetailEmptyState mensaje={t('pedidosLive.detalle.sinGranel')} />
      ) : (
        <>
          <div className="tabla-wrap">
            <table className="tabla-pedidos tabla-detalle-items">
              <thead>
                <tr>
                  <th>{t('pedidosLive.colSku')}</th>
                  <th>{t('pedidosLive.colDescripcion')}</th>
                  <th>{t('pedidosLive.colCant')}</th>
                </tr>
              </thead>
              <tbody>
                {granel.map((it) => (
                  <tr key={it.orderItemsId}>
                    <td className="sku-celda">{it.sku || '—'}</td>
                    <td>{it.itemDescription || '—'}</td>
                    <td>{it.qty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="live-detalle-nota-limitacion">{t('pedidosLive.detalle.notaGranelLimitado')}</p>
        </>
      )}
    </div>
  )
}
