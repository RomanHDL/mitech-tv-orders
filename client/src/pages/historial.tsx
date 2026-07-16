// Puerto de app/historial/page.jsx + historial-cliente.jsx — agrupado por
// nombre de pedido (case-insensitive), colapsable, con progreso agregado.
// Reusa GET /api/surtir (mismo filtro de dueño que la cola de surtido).
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Box, Check, ChevronDown, Printer, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  badgeProgreso,
  diasHastaLimite,
  formatearFechaHora,
  formatearFechaLimite,
  tienePallets,
  tiempoRestanteTexto,
  totalRequerido,
  totalSurtido,
} from '@/lib/pedido-stats'
import type { PedidoConTvs } from '@shared/schema'

type Grupo = {
  nombre: string
  pedidos: PedidoConTvs[]
  totalRequerido: number
  totalSurtido: number
  progresoPct: number
  completados: number
  ultimaFecha: Date | null
}

export default function Historial() {
  const { data: pedidos = [], isLoading } = useQuery<PedidoConTvs[]>({ queryKey: ['/api/surtir'] })
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState<Set<string>>(new Set())

  const grupos = useMemo<Grupo[]>(() => {
    const mapa = new Map<string, PedidoConTvs[]>()
    for (const p of pedidos) {
      const clave = p.pedidoNombre.trim().toLowerCase()
      if (!mapa.has(clave)) mapa.set(clave, [])
      mapa.get(clave)!.push(p)
    }
    return Array.from(mapa.values())
      .map((lista): Grupo => {
        const req = lista.reduce((s, p) => s + totalRequerido(p), 0)
        const surt = lista.reduce((s, p) => s + totalSurtido(p.televisiones), 0)
        const completados = lista.filter((p) => {
          const r = totalRequerido(p)
          return r > 0 && totalSurtido(p.televisiones) >= r
        }).length
        return {
          nombre: lista[0].pedidoNombre,
          pedidos: lista,
          totalRequerido: req,
          totalSurtido: surt,
          progresoPct: req > 0 ? Math.round((surt / req) * 100) : 0,
          completados,
          ultimaFecha: lista[0] ? new Date(lista[0].fecha) : null,
        }
      })
      .sort((a, b) => (b.ultimaFecha?.getTime() || 0) - (a.ultimaFecha?.getTime() || 0))
  }, [pedidos])

  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return grupos
    return grupos.filter(
      (g) => g.nombre.toLowerCase().includes(q) || g.pedidos.some((p) => (p.numeroPedido || '').toLowerCase().includes(q) || p.condiciones.some((c) => c.toLowerCase().includes(q)))
    )
  }, [grupos, busqueda])

  const toggle = (nombre: string) =>
    setExpandido((prev) => {
      const next = new Set(prev)
      next.has(nombre) ? next.delete(nombre) : next.add(nombre)
      return next
    })

  const todoAbierto = expandido.size === gruposFiltrados.length && gruposFiltrados.length > 0
  const toggleTodos = () => setExpandido(todoAbierto ? new Set() : new Set(gruposFiltrados.map((g) => g.nombre)))

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Historial</h1>
        <p className="text-muted-foreground">
          {grupos.length === 0 ? 'Aún no hay pedidos registrados.' : `${grupos.length} ${grupos.length === 1 ? 'nombre de pedido' : 'nombres de pedido'} · ${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} en total`}
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center shadow-sm">
          <p className="text-muted-foreground">Todavía no hay pedidos en el historial.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, número o condición…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
            </div>
            <button type="button" className="rounded-md border bg-secondary px-3 py-2 text-sm font-medium" onClick={toggleTodos} disabled={gruposFiltrados.length === 0}>
              {todoAbierto ? 'Colapsar todo' : 'Expandir todo'}
            </button>
          </div>

          {gruposFiltrados.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No se encontró nada con &quot;{busqueda}&quot;.</p>
          ) : (
            <div className="space-y-2">
              {gruposFiltrados.map((g) => {
                const abierto = expandido.has(g.nombre)
                const badge = badgeProgreso(g.progresoPct)
                return (
                  <div key={g.nombre} className="rounded-md border">
                    <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => toggle(g.nombre)} aria-expanded={abierto}>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      <div className="flex-1">
                        <h3 className="font-semibold">{g.nombre}</h3>
                        <span className="text-xs text-muted-foreground">
                          {g.pedidos.length} {g.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                          {g.completados > 0 && ` · ${g.completados} completado${g.completados === 1 ? '' : 's'}`}
                          {g.ultimaFecha && ` · último ${formatearFechaHora(g.ultimaFecha)}`}
                        </span>
                      </div>
                      <span className="font-semibold">
                        {g.totalSurtido}/{g.totalRequerido}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.clase === 'completo' ? 'bg-success/20 text-success' : badge.clase === 'parcial' ? 'bg-accent/30' : 'bg-muted'}`}>
                        {badge.label}
                      </span>
                    </button>

                    {abierto && (
                      <div className="overflow-x-auto border-t">
                        <table className="w-full min-w-[800px] text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase text-muted-foreground">
                              <th className="p-2">N° Pedido</th>
                              <th className="p-2">Fecha creación</th>
                              <th className="p-2">Fecha límite</th>
                              <th className="p-2">Tiempo restante</th>
                              <th className="p-2">Dueño</th>
                              <th className="p-2">Condiciones</th>
                              <th className="p-2">Modelos</th>
                              <th className="p-2">Total</th>
                              <th className="p-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {g.pedidos.map((p) => {
                              const dias = diasHastaLimite(p.fechaLimite)
                              const tiempo = tiempoRestanteTexto(dias)
                              const req = totalRequerido(p)
                              const surt = totalSurtido(p.televisiones)
                              const pct = req > 0 ? Math.round((surt / req) * 100) : 0
                              const badgeP = badgeProgreso(pct)
                              return (
                                <tr key={p.id} className="border-t">
                                  <td className="p-2 font-mono text-xs">{p.numeroPedido || '—'}</td>
                                  <td className="p-2 whitespace-nowrap">{formatearFechaHora(p.fecha)}</td>
                                  <td className="p-2 whitespace-nowrap">{formatearFechaLimite(p.fechaLimite)}</td>
                                  <td className="p-2 whitespace-nowrap">{tiempo.texto}</td>
                                  <td className="p-2">{p.creadoPorNombre || '—'}</td>
                                  <td className="p-2">
                                    <div className="flex flex-wrap gap-1">
                                      {p.condiciones.length > 0 ? p.condiciones.map((c) => <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">{c}</span>) : <span className="text-muted-foreground">—</span>}
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    {p.televisiones.length}
                                    {tienePallets(p.televisiones) && (
                                      <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <Box className="h-3 w-3" />
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 whitespace-nowrap font-semibold">
                                    {surt}/{req}{' '}
                                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${badgeP.clase === 'completo' ? 'bg-success/20 text-success' : badgeP.clase === 'parcial' ? 'bg-accent/30' : 'bg-muted'}`}>
                                      {badgeP.clase === 'completo' && <Check className="mr-0.5 inline h-2.5 w-2.5" />}
                                      {badgeP.label}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <Link href={`/pedidos/${p.id}/imprimir`}>
                                      <a className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                                        <Printer className="h-3 w-3" /> Imprimir
                                      </a>
                                    </Link>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
