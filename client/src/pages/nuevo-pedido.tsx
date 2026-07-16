// Puerto de app/page.jsx — formulario de captura, redirige a imprimir tras crear.
import { useLocation } from 'wouter'
import PedidoForm, { type PedidoFormData } from '@/components/pedido-form'
import { apiRequest } from '@/lib/queryClient'

export default function NuevoPedido() {
  const [, setLocation] = useLocation()

  async function enviar(data: PedidoFormData) {
    const res = await apiRequest('POST', '/api/pedidos', data)
    const { id } = await res.json()
    setLocation(`/pedidos/${id}/imprimir`)
  }

  return (
    <PedidoForm titulo="Nuevo pedido" subtitulo="Captura las TVs que se incluyen en este pedido." submitLabel="Crear pedido" onSubmit={enviar} />
  )
}
