// Tabla de Pedidos — mismas acciones reales de siempre (Imprimir/Editar/
// Eliminar), ahora agrupadas en un menú de 3 puntos para no saturar la fila.
// Columnas nuevas (Estado, Televisiones, Cantidad total) son 100% derivadas
// de datos ya presentes en PedidoConTvs — no se inventa ninguna propiedad.
import { useState } from 'react'
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import {
  MoreVertical, Printer, Pencil, Trash2, Package,
  Activity, Ban, CheckCircle2, Clock, PackagePlus, Send, GitBranch,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  cumplimientoTexto,
  formatearFechaHora,
  formatearFechaLimite,
  normalizeOrderStatus,
  progresoPct,
  tienePallets,
  totalRequerido,
  totalSurtido,
} from '@/lib/pedido-stats'
import PedidoCicloDialog from './pedido-ciclo-dialog'
import { ESTADO_LABEL, type PedidoConTvs, type EstadoOperativo } from '@shared/schema'

export type UsuarioAsignable = { id: string; nombre: string; rol: string }

// Mismos 7 colores en toda la app (badge de estado, chip de etapa, filtro).
const ESTADO_BADGE_CLASE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  EN_PROCESO: 'bg-blue-50 text-blue-700',
  TERMINADO: 'bg-teal-50 text-teal-700',
  CARGANDO: 'bg-orange-50 text-orange-700',
  LISTO_SALIDA: 'bg-violet-50 text-violet-700',
  DESPACHADO: 'bg-emerald-50 text-emerald-700',
  CANCELADO: 'bg-red-50 text-red-700',
}

const ETAPA_ICONO: Record<string, typeof Clock> = {
  PENDIENTE: Clock,
  EN_PROCESO: Activity,
  TERMINADO: CheckCircle2,
  CARGANDO: PackagePlus,
  LISTO_SALIDA: Send,
  DESPACHADO: Send,
  CANCELADO: Ban,
}

const TIEMPO_CLASE: Record<string, string> = {
  vencido: 'bg-destructive/15 text-destructive',
  urgente: 'bg-amber-100 text-amber-800',
  cercano: 'bg-yellow-100 text-yellow-800',
  normal: 'text-muted-foreground',
  despachado: 'bg-emerald-50 text-emerald-700',
  'listo-salida': 'bg-violet-50 text-violet-700',
  cargando: 'bg-orange-50 text-orange-700',
  terminado: 'bg-teal-50 text-teal-700',
  cancelado: 'bg-red-50 text-red-700',
  'sin-fecha': 'text-muted-foreground',
}

export default function PedidosTable({
  pedidos,
  esAdmin,
  rol,
  usuarios,
  asignandoId,
  eliminandoId,
  onCambiarDueno,
  onEliminar,
}: {
  pedidos: PedidoConTvs[]
  esAdmin: boolean
  rol?: string
  usuarios: UsuarioAsignable[]
  asignandoId: string | null
  eliminandoId: string | null
  onCambiarDueno: (pedidoId: string, userId: string) => void
  onEliminar: (id: string, nombre: string) => void
}) {
  const { t } = useTranslation()
  const [cicloAbierto, setCicloAbierto] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full min-w-[1300px] text-sm">
        <thead>
          <tr className="border-b bg-secondary/60 text-left text-xs font-semibold uppercase text-muted-foreground">
            <th className="p-3">{t('pedidos.colNumero')}</th>
            <th className="p-3">{t('pedidos.colPedido')}</th>
            <th className="p-3">{t('pedidos.colEstado')}</th>
            <th className="p-3">Etapa logística</th>
            <th className="p-3">{t('pedidos.colTelevisiones')}</th>
            <th className="p-3">{t('pedidos.colCantidadTotal')}</th>
            <th className="p-3">{t('pedidos.colFechaCreacion')}</th>
            <th className="p-3">{t('pedidos.colFechaLimite')}</th>
            <th className="p-3">{t('pedidos.colTiempoRestante')}</th>
            {esAdmin && <th className="p-3">{t('pedidos.colDueno')}</th>}
            <th className="p-3">{t('pedidoForm.condiciones')}</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => {
            const pct = progresoPct(p)
            const pendiente = totalRequerido(p) - totalSurtido(p.televisiones)
            const estado = normalizeOrderStatus({ progresoPct: pct, estadoOperativo: p.estadoOperativo })
            const tiempo = cumplimientoTexto({ progresoPct: pct, estadoOperativo: p.estadoOperativo, pendiente, fechaLimite: p.fechaLimite }, t)
            const EtapaIcono = ETAPA_ICONO[estado]
            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-blue-50/40">
                <td className="p-3 font-mono text-xs">{p.numeroPedido || '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{p.pedidoNombre}</span>
                    {tienePallets(p.televisiones) && (
                      <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs" title={t('pedidoForm.pallets')}>
                        <Package className="h-3 w-3" /> {t('pedidoForm.pallets')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_BADGE_CLASE[estado] || 'bg-muted text-muted-foreground'}`}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${ESTADO_BADGE_CLASE[estado] || 'bg-muted text-muted-foreground'}`}>
                    <EtapaIcono className="h-3 w-3" /> {ESTADO_LABEL[estado]}
                  </span>
                </td>
                <td className="p-3 text-center">{p.televisiones.length}</td>
                <td className="p-3 font-semibold">{totalRequerido(p)}</td>
                <td className="p-3 whitespace-nowrap">{formatearFechaHora(p.fecha)}</td>
                <td className="p-3 whitespace-nowrap">{formatearFechaLimite(p.fechaLimite)}</td>
                <td className="p-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TIEMPO_CLASE[tiempo.clase] || 'text-muted-foreground'}`}>
                    {tiempo.texto}
                  </span>
                </td>
                {esAdmin && (
                  <td className="p-3">
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-2 text-xs"
                      value={p.creadoPor || ''}
                      disabled={asignandoId === p.id}
                      onChange={(e) => onCambiarDueno(p.id, e.target.value)}
                    >
                      <option value="">{t('pedidos.sinDueno')}</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} ({u.rol})
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {p.condiciones.length > 0 ? (
                      p.condiciones.map((c) => (
                        <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('pedidos.menuAcciones')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/pedidos/${p.id}/imprimir`}>
                        <DropdownMenuItem>
                          <Printer className="h-4 w-4" /> {t('common.imprimir')}
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={() => setCicloAbierto(p.id)}>
                        <GitBranch className="h-4 w-4" /> Ver ciclo del pedido
                      </DropdownMenuItem>
                      {esAdmin && (
                        <>
                          <Link href={`/pedidos/${p.id}/editar`}>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4" /> {t('common.editar')}
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            disabled={eliminandoId === p.id}
                            onClick={() => onEliminar(p.id, p.pedidoNombre)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> {eliminandoId === p.id ? '…' : t('common.eliminar')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <PedidoCicloDialog
        pedidoId={cicloAbierto}
        rol={rol}
        open={cicloAbierto !== null}
        onOpenChange={(v) => !v && setCicloAbierto(null)}
      />
    </div>
  )
}
