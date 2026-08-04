'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconArrowLeft, IconArrowRight } from '../../components/icons'
import { formatFecha } from '../format'
import DetailEmptyState from './DetailEmptyState'

const POR_PAGINA = 10

// items: array completo de UN pedido (ya cargado, acotado — no es el
// listado global de 247k). La paginación acá es solo de presentación.
export default function OrderItemsTable({ items }) {
  const { t, i18n } = useTranslation()
  const [pagina, setPagina] = useState(1)

  if (items.length === 0) {
    return (
      <div className="live-detalle-seccion">
        <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.contenidoPedido')}</h3>
        <DetailEmptyState mensaje={t('pedidosLive.sinArticulos')} />
      </div>
    )
  }

  const totalPaginas = Math.max(1, Math.ceil(items.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const visibles = items.slice(inicio, inicio + POR_PAGINA)

  return (
    <div className="live-detalle-seccion">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.contenidoPedido')}</h3>
      <div className="tabla-wrap">
        <table className="tabla-pedidos tabla-detalle-items live-detalle-items-tabla">
          <thead>
            <tr>
              <th>{t('pedidosLive.colSku')}</th>
              <th className="live-detalle-col-descripcion">{t('pedidosLive.colDescripcion')}</th>
              <th>{t('pedidosLive.colCant')}</th>
              <th>{t('pedidosLive.colPallet')}</th>
              <th>{t('pedidosLive.detalle.colCondicion')}</th>
              <th>{t('pedidosLive.colUbicacion')}</th>
              <th>{t('pedidosLive.colUltimoMovimiento')}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((it) => (
              <tr key={it.orderItemsId}>
                <td className="sku-celda">{it.sku || '—'}</td>
                <td className="live-detalle-col-descripcion">{it.itemDescription || '—'}</td>
                <td>{it.qty ?? '—'}</td>
                <td>{it.binCode || '—'}</td>
                <td>{it.condicion || '—'}</td>
                <td>{it.ubicacion || '—'}</td>
                <td>
                  {it.ultimoMovimiento
                    ? `${it.ultimoMovimiento.tipoMovimiento} · ${it.ultimoMovimiento.movidoPor} (${formatFecha(it.ultimoMovimiento.fecha, i18n.language)})`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="live-detalle-items-pie">
        <span>
          {t('pedidosLive.detalle.mostrandoSkus', {
            count: items.length,
            desde: inicio + 1,
            hasta: Math.min(inicio + POR_PAGINA, items.length),
            total: items.length,
          })}
        </span>
        {totalPaginas > 1 && (
          <div className="live-detalle-items-nav">
            <button type="button" className="btn-icono" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaActual <= 1} aria-label={t('pedidoDetalle.pedidoAnterior')}>
              <IconArrowLeft />
            </button>
            <span className="modal-pedido-contador">{paginaActual}/{totalPaginas}</span>
            <button type="button" className="btn-icono" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual >= totalPaginas} aria-label={t('pedidoDetalle.pedidoSiguiente')}>
              <IconArrowRight />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
