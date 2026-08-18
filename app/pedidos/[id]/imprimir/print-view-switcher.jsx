'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconArrowLeft, IconPrinter } from '../../../components/icons'
import OrderPrintSheet from './order-print-sheet'
import OrderPrintSheetSimple from './order-print-sheet-simple'

// Dos vistas de la MISMA hoja impresa — completa (reporte ejecutivo, la de
// siempre) y simple (letra grande, sin colores, pensada para el piso de
// surtido) — se alternan aquí sin recargar la página ni volver a pedir los
// datos: ambas reciben exactamente las mismas props ya resueltas por
// page.jsx. Solo una vive en el DOM a la vez (nunca las dos), así que
// `#print-order-root` sigue siendo único.
export default function PrintViewSwitcher(props) {
  const router = useRouter()
  const { t } = useTranslation()
  const [modo, setModo] = useState('completo')

  return (
    <main className="imprimir-shell">
      <div className="acciones-imprimir">
        <button onClick={() => router.push('/pedidos')} className="btn-volver">
          <IconArrowLeft />
          {t('common.volver')}
        </button>
        <div className="toggle-vista-impresion" role="group" aria-label={t('imprimir.vistaLabel')}>
          <button
            type="button"
            className={modo === 'completo' ? 'activo' : ''}
            onClick={() => setModo('completo')}
          >
            {t('imprimir.vistaCompleta')}
          </button>
          <button
            type="button"
            className={modo === 'simple' ? 'activo' : ''}
            onClick={() => setModo('simple')}
          >
            {t('imprimir.vistaSimple')}
          </button>
        </div>
        <button onClick={() => window.print()} className="btn-imprimir">
          <IconPrinter />
          {t('common.imprimir')}
        </button>
      </div>

      {modo === 'completo' ? <OrderPrintSheet {...props} /> : <OrderPrintSheetSimple {...props} />}
    </main>
  )
}
