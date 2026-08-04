'use client'

import { useTranslation } from 'react-i18next'
import { formatFecha, formatMoneda } from '../format'

// resumen: la fila de la lista (webOrderId/source/accountName/cliente/
// estatus/total/moneda/enteredDate/ubicacion) — ya disponible sin esperar
// el detalle. actualizadoEn: ISO de la última consulta exitosa del detalle.
export default function OrderGeneralInfo({ resumen, actualizadoEn }) {
  const { t, i18n } = useTranslation()

  const campos = [
    { label: t('pedidosLive.detalle.cuenta'), valor: resumen.accountName || '—' },
    { label: t('pedidosLive.detalle.cliente'), valor: resumen.cliente || '—' },
    { label: t('pedidosLive.detalle.fecha'), valor: formatFecha(resumen.enteredDate, i18n.language) },
    { label: t('pedidosLive.detalle.total'), valor: formatMoneda(resumen.total, resumen.moneda, i18n.language) },
    { label: t('pedidosLive.detalle.ubicacion'), valor: resumen.ubicacion || '—' },
    { label: t('pedidosLive.detalle.tipoPedido'), valor: '—' },
    { label: t('pedidosLive.detalle.ultimaActualizacion'), valor: formatFecha(actualizadoEn, i18n.language) },
  ]

  return (
    <div className="live-detalle-datos-generales">
      {campos.map((c) => (
        <div className="dato-linea" key={c.label}>
          <span className="dato-label">{c.label}</span>
          <span className="dato-valor">{c.valor}</span>
        </div>
      ))}
    </div>
  )
}
