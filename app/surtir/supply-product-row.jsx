'use client'

import { useTranslation } from 'react-i18next'
import { unidadLabel } from '@/lib/catalogos'
import { IconAlert, IconCheck, IconMinus, IconPlus, IconRefresh } from '../components/icons'

// Una fila de SKU dentro de un grupo (marca+pulgadas). Conserva TODAS las
// acciones/indicadores que ya existían por TV — lo único nuevo son las
// celdas "Meta del SKU" / "Aporta al grupo", que reemplazan el viejo
// "Solicitado" individual cuando el grupo tiene más de un SKU (la meta ya
// no le pertenece a cada SKU, le pertenece al grupo).
export default function SupplyProductRow({ tv, individualTarget, onActualizar, resaltada = false }) {
  const { t } = useTranslation()
  const idx = tv._idx
  const esSinLimite = !!tv.sinLimite
  const surtida = esSinLimite ? (tv.cantidadSurtida || 0) : Math.min(tv.cantidad, tv.cantidadSurtida || 0)
  const pendienteTv = esSinLimite ? null : Math.max(0, tv.cantidad - surtida)
  const pctTv = esSinLimite ? null : (tv.cantidad > 0 ? Math.round((surtida / tv.cantidad) * 100) : 0)
  const completo = !esSinLimite && surtida >= tv.cantidad
  const enProgreso = surtida > 0 && !completo
  const claseFila = completo ? 'fila-surtido-completo' : enProgreso ? 'fila-surtido-parcial' : 'fila-surtido-pendiente'
  const claseProgreso = completo ? 'completa' : enProgreso ? 'avanzando' : ''
  const condTv = tv.condiciones?.join(' ') || ''
  const descTv = `${tv.marca} ${tv.pulgadas}"${condTv ? ' ' + condTv : ''}${tv.modelo ? ' ' + tv.modelo : ''}`
  const unidadTxt = unidadLabel(t, tv.cantidad || 1, tv.unidad)
  const tieneMetaIndividual = individualTarget !== null && individualTarget !== undefined

  return (
    <div key={idx} className={`fila-surtido-fila ${claseFila} ${resaltada ? 'fila-surtido-resaltada' : ''}`}>
      <div className="fila-surtido-producto">
        <div className="fila-surtido-top">
          <span className="fila-surtido-marca">{tv.marca}</span>
          <span className="fila-surtido-pulgadas">{tv.pulgadas}&quot;</span>
          {tv.esUltimoMomento && (
            <span className="tag tag-extra" title={t('surtir.tagUltimoMomentoTitle')}>
              <IconAlert width={11} height={11} /> {t('surtir.tagUltimoMomento')}
            </span>
          )}
          {tv.condiciones?.map((c) => (
            <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
          ))}
          {pctTv !== null && (
            <span className={`fila-surtido-pct ${claseProgreso}`}>{`${pctTv}%`}</span>
          )}
        </div>
        {pctTv !== null && (
          <div className="fila-surtido-bar">
            <div className={`fila-surtido-bar-fill ${claseProgreso}`} style={{ width: `${pctTv}%` }} />
          </div>
        )}
        <div className="fila-surtido-sub">
          <span>{t('surtir.modeloEtiqueta')} <b>{tv.modelo || '—'}</b></span>
          <span>· {t('surtir.skuEtiqueta')} <b>{tv.modelo || '—'}</b></span>
          {tv.modelosAlternativos?.length > 0 && (
            <span className="tv-alt-hint">
              {t('common.tambienValido', { lista: tv.modelosAlternativos.join(', ') })}
            </span>
          )}
        </div>
      </div>

      <div className="fila-surtido-controles">
        <div className="fila-surtido-metricas">
          <div className="fila-surtido-metrica">
            <span className="fila-surtido-metrica-label">{t('surtir.grupo.metaSku')}</span>
            <span className="fila-surtido-metrica-valor">
              {tieneMetaIndividual ? individualTarget : t('surtir.grupo.metaSkuNoAplica')}
            </span>
          </div>
          <div className="fila-surtido-metrica">
            <span className="fila-surtido-metrica-label">{t('surtir.grupo.aportaAlGrupo')}</span>
            <span className="fila-surtido-metrica-valor ok">{surtida}</span>
          </div>
          <div className="fila-surtido-metrica">
            <span className="fila-surtido-metrica-label">{t('common.pendiente')}</span>
            <span className="fila-surtido-metrica-valor warn">{pendienteTv === null ? '—' : pendienteTv}</span>
          </div>
        </div>

        <div className="stepper-cantidad">
          <button
            type="button"
            onClick={() => onActualizar(idx, surtida - 1, { inmediato: true })}
            disabled={surtida === 0}
            aria-label={t('surtir.restarUno')}
            title={t('surtir.restarUno')}
          >
            <IconMinus />
          </button>
          <input
            type="number"
            min="0"
            max={esSinLimite ? undefined : tv.cantidad}
            value={surtida}
            onChange={(e) => onActualizar(idx, e.target.value, { descripcion: descTv })}
            aria-label={t('surtir.cantidadSurtidaLabel')}
            className="stepper-cantidad-input"
          />
          <button
            type="button"
            onClick={() => onActualizar(idx, surtida + 1, { inmediato: true })}
            disabled={completo}
            aria-label={t('surtir.sumarUno')}
            title={t('surtir.sumarUno')}
          >
            <IconPlus />
          </button>
        </div>

        <div className="fila-surtido-acciones">
          <button
            type="button"
            className="btn-mini-action btn-listo"
            onClick={() => {
              if (esSinLimite) return
              if (confirm(t('surtir.confirmarMarcarSurtidas', { cantidad: tv.cantidad - surtida, unidad: unidadTxt, desc: descTv }))) {
                onActualizar(idx, tv.cantidad, { inmediato: true })
              }
            }}
            disabled={completo || esSinLimite}
            aria-label={t('surtir.completar')}
            title={t('surtir.completarTitle')}
          >
            <IconCheck />
          </button>
          <button
            type="button"
            className="btn-mini-action btn-reset"
            onClick={() => {
              if (confirm(t('surtir.confirmarRestablecer'))) {
                onActualizar(idx, 0, { inmediato: true })
              }
            }}
            disabled={surtida === 0}
            aria-label={t('surtir.reiniciar')}
            title={t('surtir.restablecerA0')}
          >
            <IconRefresh />
          </button>
        </div>
      </div>
    </div>
  )
}
