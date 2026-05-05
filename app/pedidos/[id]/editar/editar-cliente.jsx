'use client'

import { useRouter } from 'next/navigation'
import PedidoForm from '../../../components/pedido-form'

export default function EditarCliente({ pedido }) {
  const router = useRouter()

  const enviar = async (data) => {
    const res = await fetch(`/api/pedidos/${pedido.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Error al guardar')
    }
    router.push('/pedidos')
    router.refresh()
  }

  return (
    <PedidoForm
      titulo={`Editar pedido: ${pedido.pedidoNombre}`}
      subtitulo="Las cantidades surtidas se preservan donde el TV (marca, pulgadas, modelo, unidad) coincida."
      submitLabel="Guardar cambios"
      cancelHref="/pedidos"
      initialData={{
        pedidoNombre: pedido.pedidoNombre,
        fechaLimite: pedido.fechaLimite,
        condiciones: pedido.condiciones,
        televisiones: pedido.televisiones,
      }}
      onSubmit={enviar}
    />
  )
}
