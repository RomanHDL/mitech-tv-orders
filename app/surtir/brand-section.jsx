'use client'

import { useTranslation } from 'react-i18next'
import { calculateBrandSummary } from '@/lib/surtido-grupos'
import SizeGroupSection from './size-group-section'

// Encabezado grande y centrado por marca, seguido de sus grupos de
// pulgadas. Puramente de presentación — la agrupación real ya viene
// resuelta en `brandSection` (groupProductsByBrandAndSize).
export default function BrandSection({ brandSection, mode = 'supply', onActualizar, onFilaAccion, onCambiarMeta, highlightedIdx }) {
  const { t } = useTranslation()
  const resumen = calculateBrandSummary(brandSection)
  const esCaptura = mode === 'create' || mode === 'edit'

  return (
    <section className="brand-section">
      <header className="brand-section-header">
        <h2>{brandSection.label.toUpperCase()}</h2>
        <div className="brand-section-stats">
          <span>{t('surtir.grupo.skuCount', { count: resumen.skuCount })}</span>
          {esCaptura ? (
            <>
              <span className="brand-stat-dot">{t('pedidoForm.grupo.gruposCount', { count: brandSection.sizes.length })}</span>
              <span className="brand-stat-dot">{t('pedidoForm.grupo.piezasSolicitadas', { n: resumen.requestedDefinedTotal })}</span>
            </>
          ) : (
            <>
              <span className="brand-stat-dot">{t('surtir.resumenPedido.totalSolicitado')}: {resumen.requestedDefinedTotal}</span>
              <span className="brand-stat-dot">{t('surtir.grupo.surtidas')}: {resumen.suppliedTotal}</span>
              <span className="brand-stat-dot">{t('surtir.grupo.pendientes')}: {resumen.pendingTotal}</span>
            </>
          )}
          {resumen.undefinedGroupsCount > 0 && (
            <span className="brand-stat-dot brand-stat-undefined">
              {t('surtir.grupo.grupoPorDefinir', { count: resumen.undefinedGroupsCount })}
            </span>
          )}
        </div>
      </header>

      {brandSection.sizes.map((group) => (
        <SizeGroupSection
          key={group.key}
          group={group}
          mode={mode}
          onActualizar={onActualizar}
          onFilaAccion={onFilaAccion}
          onCambiarMeta={onCambiarMeta}
          highlightedIdx={highlightedIdx}
        />
      ))}
    </section>
  )
}
