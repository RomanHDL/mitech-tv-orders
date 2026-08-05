'use client'

import { useTranslation } from 'react-i18next'

// Resumen general del pedido — usa el total solicitado con SOLO los grupos
// que ya tienen meta definida (nunca "total menos suma absoluta de todo",
// para no dejar que un grupo por definir con piezas ya surtidas altere el
// pendiente de los grupos que sí tienen meta real).
export default function OrderSupplySummary({ orderSummary }) {
  const { t } = useTranslation()
  const {
    totalRequestedDefined, totalSupplied, totalSuppliedDefined, totalSuppliedUndefined,
    totalPending, completeCount, inProgressCount, exceededCount, undefinedCount,
  } = orderSummary

  const progresoPct = totalRequestedDefined > 0 ? Math.round((totalSuppliedDefined / totalRequestedDefined) * 100) : 0

  return (
    <div className="orden-resumen-grid">
      <article className="orden-resumen-card">
        <div className="orden-resumen-label">{t('surtir.resumenPedido.totalSolicitado')}</div>
        <div className="orden-resumen-valor">{totalRequestedDefined}</div>
      </article>
      <article className="orden-resumen-card">
        <div className="orden-resumen-label">{t('surtir.resumenPedido.totalSurtido')}</div>
        <div className="orden-resumen-valor">{totalSupplied}</div>
        {totalSuppliedUndefined > 0 && (
          <div className="orden-resumen-detalle">
            {t('surtir.resumenPedido.desgloseSurtido', { definido: totalSuppliedDefined, porDefinir: totalSuppliedUndefined })}
          </div>
        )}
      </article>
      <article className="orden-resumen-card">
        <div className="orden-resumen-label">{t('surtir.resumenPedido.totalPendiente')}</div>
        <div className="orden-resumen-valor">{totalPending}</div>
      </article>
      <article className="orden-resumen-card orden-resumen-card-complete">
        <div className="orden-resumen-label">{t('surtir.resumenPedido.gruposCompletos')}</div>
        <div className="orden-resumen-valor">{completeCount}</div>
      </article>
      <article className="orden-resumen-card orden-resumen-card-progress">
        <div className="orden-resumen-label">{t('surtir.resumenPedido.gruposEnProceso')}</div>
        <div className="orden-resumen-valor">{inProgressCount}</div>
      </article>
      {exceededCount > 0 && (
        <article className="orden-resumen-card orden-resumen-card-exceeded">
          <div className="orden-resumen-label">{t('surtir.resumenPedido.gruposExcedidos')}</div>
          <div className="orden-resumen-valor">{exceededCount}</div>
        </article>
      )}
      {undefinedCount > 0 && (
        <article className="orden-resumen-card orden-resumen-card-undefined">
          <div className="orden-resumen-label">{t('surtir.resumenPedido.gruposPorDefinir')}</div>
          <div className="orden-resumen-valor">{undefinedCount}</div>
        </article>
      )}

      <div className="orden-resumen-progreso">
        <div className="progreso-track">
          <div className={`progreso-fill ${progresoPct >= 100 ? 'completa' : ''}`} style={{ width: `${Math.min(100, progresoPct)}%` }} />
        </div>
        <span className="orden-resumen-progreso-pct">{progresoPct}%</span>
      </div>
    </div>
  )
}
