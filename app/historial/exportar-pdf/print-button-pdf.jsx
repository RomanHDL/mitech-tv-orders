'use client'

import { useTranslation } from 'react-i18next'
import { IconArrowLeft, IconPrinter } from '../../components/icons'

export default function PrintButtonPdf() {
  const { t } = useTranslation()
  return (
    <div className="pdf-acciones-imprimir">
      <button onClick={() => window.close()} className="btn-volver">
        <IconArrowLeft />
        {t('common.cerrar')}
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        <IconPrinter />
        {t('historial.imprimirGuardarPdf')}
      </button>
    </div>
  )
}
