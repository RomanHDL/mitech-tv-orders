'use client'

import { useTranslation } from 'react-i18next'

// Captura la meta de UN grupo (marca+pulgadas) — una sola vez por grupo,
// nunca por SKU. "Cantidad por definir" guarda explícitamente null (nunca
// 0): isRequestedQuantityDefined() en lib/surtido-grupos.js es la única
// fuente de verdad para distinguir 0/null/undefined/''.
export default function GroupTargetInput({ requested, unicoSku, onChange }) {
  const { t } = useTranslation()
  const porDefinir = requested === null || requested === undefined

  return (
    <div className="group-target-input">
      <label className="group-target-label">
        {unicoSku ? t('pedidoForm.grupo.solicitadoGrupoYSku') : t('pedidoForm.grupo.solicitadoGrupo')}
      </label>
      <div className="group-target-controles">
        <input
          type="number"
          min="0"
          step="1"
          value={porDefinir ? '' : requested}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
          disabled={porDefinir}
          placeholder={t('surtir.grupo.porDefinir')}
          className="group-target-numero"
          aria-label={t('pedidoForm.grupo.solicitadoGrupo')}
        />
        <label className="group-target-checkbox">
          <input
            type="checkbox"
            checked={porDefinir}
            onChange={(e) => onChange(e.target.checked ? null : 0)}
          />
          {t('pedidoForm.grupo.cantidadPorDefinir')}
        </label>
      </div>
    </div>
  )
}
