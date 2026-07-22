'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PedidoForm from './components/pedido-form'

export default function FormularioPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const enviar = async (data) => {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || t('pedidoForm.errorGuardarPedido'))
    }
    const { id } = await res.json()
    router.push(`/pedidos/${id}/imprimir`)
  }

  return <PedidoForm onSubmit={enviar} />
}
