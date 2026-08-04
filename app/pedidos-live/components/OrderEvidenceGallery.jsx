'use client'

import { useTranslation } from 'react-i18next'
import { IconImageOff } from '../../components/icons'

// Esta fuente de datos (WMS + API de pallets) no expone fotografías en
// ningún nivel — nunca se inventan ni se usan imágenes externas de
// reemplazo. Siempre se muestra el placeholder elegante "Sin foto".
export default function OrderEvidenceGallery() {
  const { t } = useTranslation()

  return (
    <div className="live-detalle-seccion">
      <h3 className="live-detalle-titulo">{t('pedidosLive.detalle.fotografiasEvidencia')}</h3>
      <div className="evidencia-grid">
        {[0, 1, 2].map((i) => (
          <div className="evidencia-placeholder" key={i}>
            <IconImageOff />
            <span>{t('pedidosLive.detalle.sinFoto')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
