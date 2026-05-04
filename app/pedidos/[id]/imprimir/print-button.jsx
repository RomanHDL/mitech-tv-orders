'use client'

import { useRouter } from 'next/navigation'

export default function PrintButton() {
  const router = useRouter()

  return (
    <div className="acciones-imprimir">
      <button onClick={() => router.push('/pedidos')} className="btn-volver">
        ← Volver
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        Imprimir
      </button>
    </div>
  )
}
