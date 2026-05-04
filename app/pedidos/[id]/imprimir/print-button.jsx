'use client'

import { useRouter } from 'next/navigation'
import { IconArrowLeft, IconPrinter } from '../../../components/icons'

export default function PrintButton() {
  const router = useRouter()

  return (
    <div className="acciones-imprimir">
      <button onClick={() => router.push('/pedidos')} className="btn-volver">
        <IconArrowLeft />
        Volver
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        <IconPrinter />
        Imprimir
      </button>
    </div>
  )
}
