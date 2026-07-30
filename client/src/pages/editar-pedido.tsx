// Puerto de app/pedidos/[id]/editar — carga el pedido, reusa <PedidoForm>
// con initialData, PUT al guardar. Las cantidadSurtida se preservan en el
// server (misma regla que el PUT original).
import { useParams, useLocation } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PedidoForm, { type PedidoFormData } from '@/components/pedido-form'
import { apiRequest } from '@/lib/queryClient'
import type { PedidoConTvs } from '@shared/schema'

export default function EditarPedido() {
  const { id } = useParams<{ id: string }>()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const { data: pedido, isLoading } = useQuery<PedidoConTvs>({ queryKey: [`/api/pedidos/${id}`] })

  async function enviar(data: PedidoFormData) {
    await apiRequest('PUT', `/api/pedidos/${id}`, data)
    await queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] })
    setLocation('/pedidos')
  }

  if (isLoading) return null
  if (!pedido) return <main className="p-6">{t('editarPedido.noEncontrado')}</main>

  return (
    <PedidoForm
      titulo={t('editarPedido.titulo', { nombre: pedido.pedidoNombre })}
      subtitulo={t('editarPedido.subtitulo')}
      submitLabel={t('editarPedido.guardarCambios')}
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
          condicion: tv.condicion,
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
