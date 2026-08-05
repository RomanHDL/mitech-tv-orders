'use client'

import { useTranslation } from 'react-i18next'
import { GROUP_STATUS, groupStatusLabel } from '@/lib/surtido-grupos'
import SupplyProductRow from './supply-product-row'
import EditableProductRow from '../components/editable-product-row'
import GroupTargetInput from '../components/group-target-input'

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
//
// mode: 'supply' (Surtir, diseño aprobado sin cambios) | 'create' | 'edit'
// (Nuevo/Editar pedido — la meta se CAPTURA aquí, sin controles de surtido).
export default function SizeGroupSection({ group, mode = 'supply', onActualizar, onFilaAccion, onCambiarMeta }) {
  const { t } = useTranslation()
  const { summary } = group
  const esCaptura = mode === 'create' || mode === 'edit'
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

        {esCaptura ? (
          <GroupTargetInput
            requested={group.requested}
            unicoSku={group.products.length === 1}
            onChange={(valor) => onCambiarMeta(group.key, valor)}
          />
        ) : (
          <>
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
          </>
        )}
      </header>

      {esCaptura && group.products.length > 1 && summary.requested !== null && summary.requested !== undefined && (
        <p className="size-group-aviso-meta-conjunta">
          {t('pedidoForm.grupo.avisoMetaConjunta', { n: summary.requested, count: group.products.length })}
        </p>
      )}
      {!esCaptura && summary.status === GROUP_STATUS.UNDEFINED && (
        <p className="size-group-aviso-por-definir">{t('surtir.grupo.avisoPorDefinir')}</p>
      )}

      <div className="size-group-filas">
        {group.products.map((tv) =>
          esCaptura ? (
            <EditableProductRow
              key={tv._idx}
              tv={tv}
              individualTarget={summary.individualTarget}
              onAccion={onFilaAccion}
              esPrimera={tv._idx === group.products[0]._idx}
              esUltima={tv._idx === group.products[group.products.length - 1]._idx}
            />
          ) : (
            <SupplyProductRow
              key={tv._idx}
              tv={tv}
              individualTarget={summary.individualTarget}
              onActualizar={onActualizar}
            />
          )
        )}
      </div>
    </section>
  )
}
