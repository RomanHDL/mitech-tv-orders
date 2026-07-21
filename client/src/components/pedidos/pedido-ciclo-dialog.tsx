// Diálogo de "Ciclo del pedido" — abierto desde el menú de 3 puntos de la
// tabla de /pedidos. Vive aparte de PedidosTable para no inflar esa tabla:
// trae su propio fetch (necesita la bitácora completa, que la lista no
// incluye) y las acciones de avance de etapa (admin/surtidor).
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/queryClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import StepperEtapas from './stepper-etapas'
import { normalizeOrderStatus, progresoPct, totalRequerido, totalSurtido } from '@/lib/pedido-stats'
import {
  ESTADO_LABEL,
  type PedidoConTvs,
  type PedidoEstadoLogRow,
  type EstadoOperativo,
} from '@shared/schema'

type PedidoDetalle = PedidoConTvs & { historialEstados?: PedidoEstadoLogRow[] }

function proximaEtapa(estado: EstadoOperativo): { destino: EstadoOperativo; label: string } | null {
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO') {
    return { destino: 'CARGANDO', label: 'Iniciar carga' }
  }
  if (estado === 'CARGANDO') return { destino: 'LISTO_SALIDA', label: 'Marcar listo para salida' }
  if (estado === 'LISTO_SALIDA') return { destino: 'DESPACHADO', label: 'Confirmar despacho' }
  return null
}

export default function PedidoCicloDialog({
  pedidoId,
  rol,
  open,
  onOpenChange,
}: {
  pedidoId: string | null
  rol: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState('')

  const { data: pedido } = useQuery<PedidoDetalle>({
    queryKey: [`/api/pedidos/${pedidoId}`],
    enabled: open && !!pedidoId,
  })

  if (!pedidoId) return null

  const pct = pedido ? progresoPct(pedido) : 0
  const pendiente = pedido ? totalRequerido(pedido) - totalSurtido(pedido.televisiones) : 0
  const estado = pedido ? normalizeOrderStatus({ progresoPct: pct, estadoOperativo: pedido.estadoOperativo }) : 'PENDIENTE'
  const puedeAvanzar = rol === 'admin' || rol === 'surtidor'
  const siguiente = proximaEtapa(estado)
  const puedeCancelar = estado !== 'DESPACHADO' && estado !== 'CANCELADO'

  async function avanzar(destino: EstadoOperativo) {
    setError('')
    let razon: string | null = null
    if (destino === 'DESPACHADO') {
      if (!confirm('¿Confirmas que este pedido ya salió de las instalaciones?')) return
      if (pendiente > 0) {
        if (rol !== 'admin') {
          setError('No se puede despachar con unidades pendientes.')
          return
        }
        razon = window.prompt('Este pedido tiene unidades pendientes. Escribe la razón para despachar de todos modos:')
        if (!razon || !razon.trim()) return
      }
    }
    if (destino === 'CANCELADO' && !confirm('¿Confirmas que quieres cancelar este pedido?')) return

    setCambiando(true)
    try {
      await apiRequest('PATCH', `/api/pedidos/${pedidoId}/estado`, { estado: destino, razon })
      await queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] })
      await queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Ciclo del pedido {pedido?.numeroPedido ? `#${pedido.numeroPedido}` : ''}
          </DialogTitle>
        </DialogHeader>

        {!pedido ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <StepperEtapas estado={estado} />

            {puedeAvanzar && (siguiente || puedeCancelar) && (
              <div className="flex flex-wrap gap-2">
                {siguiente && (
                  <button
                    type="button"
                    onClick={() => avanzar(siguiente.destino)}
                    disabled={cambiando}
                    className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {siguiente.label}
                  </button>
                )}
                {puedeCancelar && (
                  <button
                    type="button"
                    onClick={() => avanzar('CANCELADO')}
                    disabled={cambiando}
                    className="inline-flex h-9 items-center rounded-md border border-destructive px-3 text-sm font-semibold text-destructive disabled:opacity-50"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            )}

            {error && <div className="text-sm font-semibold text-destructive">{error}</div>}

            {pedido.historialEstados && pedido.historialEstados.length > 0 && (
              <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                {pedido.historialEstados.map((h, i) => (
                  <li key={i}>
                    <strong>{ESTADO_LABEL[h.estadoNuevo] || h.estadoNuevo}</strong>
                    {' — '}
                    {h.usuarioNombre || 'usuario'}
                    {h.observacion ? ` · ${h.observacion}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
