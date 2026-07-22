'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconArrowLeft, IconPrinter } from '../../../components/icons'

export default function PrintButton() {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="acciones-imprimir">
      <button onClick={() => router.push('/pedidos')} className="btn-volver">
        <IconArrowLeft />
        {t('common.volver')}
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        <IconPrinter />
        {t('common.imprimir')}
      </button>
    </div>
  )
}
