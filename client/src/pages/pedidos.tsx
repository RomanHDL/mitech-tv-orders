// Puerto de app/pedidos/page.jsx + lista-cliente.jsx — lista con búsqueda,
// export Excel, reasignar dueño (admin) y print/editar/eliminar.
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, FileSpreadsheet, FileText, Package, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { descargarPedidosXLSX } from '@/lib/exportar-pedidos'
import {
  badgeProgreso,
  diasHastaLimite,
  formatearFechaHora,
  formatearFechaLimite,
  progresoPct,
  tienePallets,
  tiempoRestanteTexto,
  totalRequerido,
  totalSurtido,
} from '@/lib/pedido-stats'
import type { PedidoConTvs } from '@shared/schema'

type UsuarioAsignable = { id: string; nombre: string; rol: string }

export default function Pedidos() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const esAdmin = usuario?.rol === 'admin'

  const { data: pedidos = [], isLoading } = useQuery<PedidoConTvs[]>({ queryKey: ['/api/pedidos'] })
  const { data: usuarios = [] } = useQuery<UsuarioAsignable[]>({
    queryKey: ['/api/usuarios/asignables'],
    enabled: esAdmin,
  })

  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [asignandoId, setAsignandoId] = useState<string | null>(null)

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter(
      (p) =>
        p.pedidoNombre.toLowerCase().includes(q) ||
        (p.numeroPedido || '').toLowerCase().includes(q) ||
        p.condiciones.some((c) => c.toLowerCase().includes(q))
    )
  }, [pedidos, busqueda])

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/pedidos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] }),
  })

  const duenoMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) =>
      apiRequest('PATCH', `/api/pedidos/${id}/dueno`, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] }),
  })

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el pedido "${nombre}"? Esta acción no se puede deshacer.`)) return
    setError('')
    setEliminandoId(id)
    try {
      await eliminarMutation.mutateAsync(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setEliminandoId(null)
    }
  }

  async function cambiarDueno(pedidoId: string, userId: string) {
    setError('')
    setAsignandoId(pedidoId)
    try {
      await duenoMutation.mutateAsync({ id: pedidoId, userId: userId || null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar dueño')
    } finally {
      setAsignandoId(null)
    }
  }

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Pedidos</h1>
        <p className="text-muted-foreground">
          {pedidos.length === 0 ? 'Aún no hay pedidos guardados.' : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} en total`}
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-semibold">No hay pedidos aún</h3>
          <p className="text-muted-foreground">Crea tu primer pedido para comenzar.</p>
          <Link href="/">
            <Button className="mt-4">
              <Plus className="h-4 w-4" /> Nuevo pedido
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número, nombre o condición…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
            </div>
            <Button variant="secondary" onClick={() => descargarPedidosXLSX(pedidosFiltrados)} disabled={pedidosFiltrados.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Link href="/">
              <Button>
                <Plus className="h-4 w-4" /> Nuevo pedido
              </Button>
            </Link>
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pedidosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No se encontraron pedidos con &quot;{busqueda}&quot;.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">N° Pedido</th>
                    <th className="p-2">Pedido</th>
                    <th className="p-2">Fecha creación</th>
                    <th className="p-2">Fecha límite</th>
                    <th className="p-2">Tiempo restante</th>
                    {esAdmin && <th className="p-2">Dueño</th>}
                    <th className="p-2">Condiciones</th>
                    <th className="p-2">Total</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((p) => {
                    const pct = progresoPct(p)
                    const badge = badgeProgreso(pct)
                    const dias = diasHastaLimite(p.fechaLimite)
                    const tiempo = tiempoRestanteTexto(dias)
                    const surtido = totalSurtido(p.televisiones)
                    const requerido = totalRequerido(p)
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-2 font-mono text-xs">{p.numeroPedido || '—'}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{p.pedidoNombre}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                badge.clase === 'completo'
                                  ? 'bg-success/20 text-success'
                                  : badge.clase === 'parcial'
                                    ? 'bg-accent/30 text-accent-foreground'
                                    : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {badge.label}
                            </span>
                            {tienePallets(p.televisiones) && (
                              <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs" title="Incluye pallets">
                                <Package className="h-3 w-3" /> Pallets
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatearFechaHora(p.fecha)}</td>
                        <td className="p-2 whitespace-nowrap">{formatearFechaLimite(p.fechaLimite)}</td>
                        <td className="p-2">
                          <span
                            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${
                              tiempo.clase === 'vencido'
                                ? 'bg-destructive/15 text-destructive'
                                : tiempo.clase === 'urgente'
                                  ? 'bg-accent/30'
                                  : tiempo.clase === 'cercano'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'text-muted-foreground'
                            }`}
                          >
                            {tiempo.texto}
                          </span>
                        </td>
                        {esAdmin && (
                          <td className="p-2">
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                              value={p.creadoPor || ''}
                              disabled={asignandoId === p.id}
                              onChange={(e) => cambiarDueno(p.id, e.target.value)}
                            >
                              <option value="">— sin dueño —</option>
                              {usuarios.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nombre} ({u.rol})
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="p-2">
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
                        <td className="p-2 whitespace-nowrap font-semibold">
                          {surtido}/{requerido}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <Link href={`/pedidos/${p.id}/imprimir`}>
                              <Button size="sm">
                                <Printer className="h-3.5 w-3.5" /> Imprimir
                              </Button>
                            </Link>
                            {esAdmin && (
                              <>
                                <Link href={`/pedidos/${p.id}/editar`}>
                                  <Button size="sm" variant="secondary">
                                    Editar
                                  </Button>
                                </Link>
                                <Button size="sm" variant="destructive" disabled={eliminandoId === p.id} onClick={() => eliminar(p.id, p.pedidoNombre)}>
                                  <Trash2 className="h-3.5 w-3.5" /> {eliminandoId === p.id ? '…' : 'Eliminar'}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
