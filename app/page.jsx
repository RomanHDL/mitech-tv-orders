'use client'

import { useRouter } from 'next/navigation'
import PedidoForm from './components/pedido-form'

export default function FormularioPage() {
  const router = useRouter()

  const enviar = async (data) => {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Error al guardar')
    }
    const { id } = await res.json()
    router.push(`/pedidos/${id}/imprimir`)
  }

  return (
    <PedidoForm
      titulo="Nuevo pedido"
      subtitulo="Captura las TVs que se incluyen en este pedido."
      submitLabel="Crear pedido"
      onSubmit={enviar}
    />
  )
}
