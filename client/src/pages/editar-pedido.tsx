// Puerto de app/pedidos/[id]/editar — carga el pedido, reusa <PedidoForm>
// con initialData, PUT al guardar. Las cantidadSurtida se preservan en el
// server (misma regla que el PUT original).
import { useParams, useLocation } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PedidoForm, { type PedidoFormData } from '@/components/pedido-form'
import { apiRequest } from '@/lib/queryClient'
import type { PedidoConTvs } from '@shared/schema'

export default function EditarPedido() {
  const { id } = useParams<{ id: string }>()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: pedido, isLoading } = useQuery<PedidoConTvs>({ queryKey: [`/api/pedidos/${id}`] })

  async function enviar(data: PedidoFormData) {
    await apiRequest('PUT', `/api/pedidos/${id}`, data)
    await queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] })
    setLocation('/pedidos')
  }

  if (isLoading) return null
  if (!pedido) return <main className="p-6">Pedido no encontrado.</main>

  return (
    <PedidoForm
      titulo={`Editar pedido: ${pedido.pedidoNombre}`}
      subtitulo="Las cantidades surtidas se preservan donde el TV (marca, pulgadas, modelo, unidad) coincida."
      submitLabel="Guardar cambios"
      cancelHref="/pedidos"
      initialData={{
        numeroPedido: pedido.numeroPedido,
        pedidoNombre: pedido.pedidoNombre,
        fechaLimite: pedido.fechaLimite,
        condiciones: pedido.condiciones,
        cantidadTotal: pedido.cantidadTotal,
        televisiones: pedido.televisiones.map((tv) => ({
          marca: tv.marca,
          pulgadas: tv.pulgadas,
          modelo: tv.modelo,
          cantidad: tv.cantidad,
          unidad: tv.unidad,
          sinLimite: tv.sinLimite,
          modelosAlternativos: tv.modelosAlternativos,
        })),
      }}
      onSubmit={enviar}
    />
  )
}
