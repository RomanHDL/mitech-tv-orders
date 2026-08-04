'use client'

import { useTranslation } from 'react-i18next'
import { claseBadgeEstatus } from '../estatus'
import { formatFecha, formatMoneda } from '../format'

export default function LiveOrdersTable({ pedidos, onVerDetalle }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="tabla-wrap live-orders-tabla-wrap">
      <table className="tabla-pedidos live-orders-tabla">
        <thead>
          <tr>
            <th>{t('pedidosLive.colPedido')}</th>
            <th>{t('pedidosLive.colMarketplace')}</th>
            <th>{t('pedidosLive.colCuenta')}</th>
            <th>{t('pedidosLive.colCliente')}</th>
            <th>{t('pedidosLive.colEstatus')}</th>
            <th>{t('pedidosLive.colFecha')}</th>
            <th>{t('pedidosLive.colUbicacion')}</th>
            <th className="live-orders-col-total">{t('pedidosLive.colTotal')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.orderId}>
              <td data-label={t('pedidosLive.colPedido')}>
                <div className="pedido-nombre">
                  #{p.orderId}
                  {p.webOrderId && <span className="tag-empty">{p.webOrderId}</span>}
                </div>
              </td>
              <td data-label={t('pedidosLive.colMarketplace')}>{p.source || '—'}</td>
              <td data-label={t('pedidosLive.colCuenta')}>{p.accountName || '—'}</td>
              <td data-label={t('pedidosLive.colCliente')}>{p.cliente || '—'}</td>
              <td data-label={t('pedidosLive.colEstatus')}>
                <span className={`badge-estatus ${claseBadgeEstatus(p.estatus)}`}>
                  {p.estatus || t('pedidosLive.sinEstatus')}
                </span>
              </td>
              <td data-label={t('pedidosLive.colFecha')}>{formatFecha(p.enteredDate, i18n.language)}</td>
              <td data-label={t('pedidosLive.colUbicacion')}>{p.ubicacion || '—'}</td>
              <td data-label={t('pedidosLive.colTotal')} className="live-orders-col-total">
                {formatMoneda(p.total, p.moneda, i18n.language)}
              </td>
              <td>
                <div className="acciones">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onVerDetalle(p.orderId)}>
                    {t('pedidosLive.verDetalle')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
