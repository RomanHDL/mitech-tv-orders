'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PedidoForm from '../../../components/pedido-form'

export default function EditarCliente({ pedido }) {
  const router = useRouter()
  const { t } = useTranslation()

  const enviar = async (data) => {
    const res = await fetch(`/api/pedidos/${pedido.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || t('pedidoForm.errorGuardarPedido'))
    }
    router.push('/pedidos')
    router.refresh()
  }

  return (
    <PedidoForm
      titulo={t('pedidoForm.editarPedidoTitulo', { nombre: pedido.pedidoNombre })}
      subtitulo={t('pedidoForm.editarSubtitulo')}
      submitLabel={t('usuarios.guardarCambios')}
      cancelHref="/pedidos"
      initialData={{
        numeroPedido: pedido.numeroPedido,
        pedidoNombre: pedido.pedidoNombre,
        fechaLimite: pedido.fechaLimite,
        condiciones: pedido.condiciones,
        cantidadTotal: pedido.cantidadTotal,
        televisiones: pedido.televisiones,
        metasGrupo: pedido.metasGrupo || {},
      }}
      onSubmit={enviar}
    />
  )
}
