'use client'

import { useTranslation } from 'react-i18next'
import { GROUP_STATUS, groupStatusLabel } from '@/lib/surtido-grupos'
import SupplyProductRow from './supply-product-row'

const CLASE_ESTADO = {
  [GROUP_STATUS.UNDEFINED]: 'undefined',
  [GROUP_STATUS.NOT_STARTED]: 'pending',
  [GROUP_STATUS.IN_PROGRESS]: 'progress',
  [GROUP_STATUS.COMPLETE]: 'complete',
  [GROUP_STATUS.EXCEEDED]: 'exceeded',
}

// Un grupo = marca + pulgadas. La meta le pertenece al GRUPO, no a cada SKU:
// varios SKU aportan libremente hasta completar la meta conjunta (nunca se
// reparte automáticamente entre ellos).
export default function SizeGroupSection({ group, onActualizar }) {
  const { t } = useTranslation()
  const { summary } = group
  const requestedText = summary.requested === null || summary.requested === undefined
    ? t('surtir.grupo.porDefinir')
    : summary.requested
  const pendingText = summary.pending === null || summary.pending === undefined ? '—' : summary.pending

  return (
    <section className="size-group-section">
      <header className="size-group-header">
        <div className="size-group-nombre">
          <h3>{group.brand} {group.size}&quot;</h3>
          <span className="size-group-sku-count">{t('surtir.grupo.skuCount', { count: group.products.length })}</span>
        </div>

        <div className="size-group-metricas">
          <div className="size-group-metrica">
            <span>{t('surtir.grupo.solicitadoGrupo')}</span>
            <strong>{requestedText}</strong>
          </div>
          <div className="size-group-metrica">
            <span>{t('surtir.grupo.surtidoGrupo')}</span>
            <strong>{summary.supplied}</strong>
          </div>
          <div className="size-group-metrica">
            <span>{t('surtir.grupo.pendienteGrupo')}</span>
            <strong>{pendingText}</strong>
          </div>
          <div className="size-group-metrica">
            <span>{t('surtir.grupo.excedente')}</span>
            <strong>{summary.excess}</strong>
          </div>
        </div>

        <span className={`size-group-status status-${CLASE_ESTADO[summary.status]}`}>
          {groupStatusLabel(t, summary.status, summary.excess)}
        </span>
      </header>

      {summary.status === GROUP_STATUS.UNDEFINED && (
        <p className="size-group-aviso-por-definir">{t('surtir.grupo.avisoPorDefinir')}</p>
      )}

      <div className="size-group-filas">
        {group.products.map((tv) => (
          <SupplyProductRow
            key={tv._idx}
            tv={tv}
            individualTarget={summary.individualTarget}
            onActualizar={onActualizar}
          />
        ))}
      </div>
    </section>
  )
}
