'use client'

import { useTranslation } from 'react-i18next'
import {
  IconAlert, IconBox, IconClipboardList, IconClock, IconLayers, IconTruck,
} from '../../components/icons'
import { formatFecha } from '../format'

const TARJETAS = [
  { key: 'totalSkus', clase: 'resumen-op-skus', Icono: IconClipboardList },
  { key: 'piezasTotales', clase: 'resumen-op-piezas', Icono: IconBox },
  { key: 'palletsAsociados', clase: 'resumen-op-pallets', Icono: IconLayers },
  { key: 'tvsGranel', clase: 'resumen-op-granel', Icono: IconTruck },
  { key: 'incidencias', clase: 'resumen-op-incidencias', Icono: IconAlert },
  { key: 'ultimoMovimiento', clase: 'resumen-op-ultimo', Icono: IconClock },
]

// items/pallets/granel: arrays reales del detalle. bucket: clasificación
// visual del estatus del pedido (ver estatus.js) — 'incidencia' es la
// única señal real de incidencia que ofrece este dataset (no hay tabla de
// incidencias separada), por eso el KPI es 0/1 derivado del propio estatus.
export default function OrderOperationalSummary({ items, pallets, granel, bucket }) {
  const { t, i18n } = useTranslation()

  const totalSkus = items.length
  const piezasTotales = items.reduce((sum, it) => sum + (it.qty || 0), 0)
  const palletsAsociados = pallets.length
  const tvsGranel = granel.reduce((sum, it) => sum + (it.qty || 0), 0)
  const incidencias = bucket === 'incidencia' ? 1 : 0

  const movimientos = pallets
    .map((p) => p.ultimoMovimiento)
    .filter(Boolean)
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  const ultimoMovimientoFecha = movimientos[0]?.fecha ? formatFecha(movimientos[0].fecha, i18n.language) : '—'

  const valores = {
    totalSkus, piezasTotales, palletsAsociados, tvsGranel, incidencias,
    ultimoMovimiento: ultimoMovimientoFecha,
  }

  return (
    <div className="live-detalle-seccion">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.resumenOperativo')}</h3>
      <div className="resumen-operativo-grid">
        {TARJETAS.map(({ key, clase, Icono }) => (
          <div key={key} className={`resumen-op-card ${clase}`}>
            <span className="resumen-op-icono"><Icono /></span>
            <div className="resumen-op-info">
              <span className="resumen-op-etiqueta">{t(`pedidosLive.detalle.kpi.${key}`)}</span>
              <span className="resumen-op-valor">{valores[key]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
