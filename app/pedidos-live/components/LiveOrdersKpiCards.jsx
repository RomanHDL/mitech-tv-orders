'use client'

import { useTranslation } from 'react-i18next'
import { IconActivity, IconBox, IconCart, IconCheckCircle } from '../../components/icons'
import { formatearNumero } from '@/lib/intl-format'

const TARJETAS = [
  { key: 'pedidosHoy', clase: 'kpi-pedidosHoy', Icono: IconCart },
  { key: 'porSurtir', clase: 'kpi-porSurtir', Icono: IconBox },
  { key: 'enProceso', clase: 'kpi-enProceso', Icono: IconActivity },
  { key: 'terminados', clase: 'kpi-terminados', Icono: IconCheckCircle },
]

// stats: { pedidosHoy, porSurtir, enProceso, enviado, ... } | null (aún sin
// cargar o falló) — cada tarjeta muestra "—" si su valor no está disponible.
export default function LiveOrdersKpiCards({ stats }) {
  const { t, i18n } = useTranslation()

  const valorDe = (key) => {
    if (!stats) return null
    if (key === 'terminados') return stats.enviado
    return stats[key]
  }

  return (
    <div className="kpi-grid">
      {TARJETAS.map(({ key, clase, Icono }) => {
        const valor = valorDe(key)
        return (
          <div key={key} className={`metrica-card kpi-card ${clase}`}>
            <span className="metrica-icono kpi-icono">
              <Icono />
            </span>
            <div className="kpi-info">
              <div className="metrica-titulo kpi-titulo">{t(`pedidosLive.kpi.${key}`)}</div>
              <div className="metrica-valor kpi-valor">
                {valor === null || valor === undefined ? '—' : formatearNumero(valor, i18n.language)}
              </div>
            </div>
            <IconActivity className="kpi-indicador" aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}
