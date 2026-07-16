// Puerto de app/surtir/page.jsx + surtir-lista-cliente.jsx — cola de
// surtido en tarjetas. admin/surtidor ven todo; capturista solo lo suyo
// (filtrado server-side en GET /api/surtir).
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Box, Check, Clipboard } from 'lucide-react'
import { progresoPct, totalRequerido, totalSurtido, formatearFechaLimite } from '@/lib/pedido-stats'
import type { PedidoConTvs } from '@shared/schema'

export default function Surtir() {
  const { data: pedidos = [], isLoading } = useQuery<PedidoConTvs[]>({
    queryKey: ['/api/surtir'],
    refetchInterval: 5000,
  })
  const [verCompletados, setVerCompletados] = useState(false)

  const { pendientes, completados } = useMemo(() => {
    const pend: PedidoConTvs[] = []
    const comp: PedidoConTvs[] = []
    for (const p of pedidos) {
      const req = totalRequerido(p)
      const surt = totalSurtido(p.televisiones)
      const completado = req > 0 && surt >= req
      ;(completado ? comp : pend).push(p)
    }
    return { pendientes: pend, completados: comp }
  }, [pedidos])

  const lista = verCompletados ? [...pendientes, ...completados] : pendientes

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Surtir pedidos</h1>
        <p className="text-muted-foreground">
          {pendientes.length === 0 ? 'No hay pedidos pendientes por surtir.' : `${pendientes.length} ${pendientes.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`}
        </p>
      </div>

      {completados.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            className="rounded-md border bg-secondary px-3 py-1.5 text-sm font-medium"
            onClick={() => setVerCompletados((v) => !v)}
          >
            {verCompletados ? 'Ocultar' : 'Mostrar'} completados ({completados.length})
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center shadow-sm">
          <Clipboard className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-semibold">No hay pedidos pendientes</h3>
          <p className="text-muted-foreground">Todos los pedidos ya fueron surtidos.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => {
            const req = totalRequerido(p)
            const surt = totalSurtido(p.televisiones)
            const pct = progresoPct(p)
            const completado = req > 0 && surt >= req
            const marcas = new Set(p.televisiones.map((t) => t.marca).filter(Boolean)).size
            const totalPallets = p.televisiones.reduce((s, tv) => s + (tv.unidad === 'pallet' ? tv.cantidad || 0 : 0), 0)
            const totalPiezas = p.televisiones.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? tv.cantidad || 0 : 0), 0)
            return (
              <Link key={p.id} href={`/surtir/${p.id}`}>
                <a
                  className={`block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md ${
                    completado ? 'border-success bg-success/5' : pct > 0 ? 'border-accent' : ''
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">
                      {p.numeroPedido && <span className="text-muted-foreground">#{p.numeroPedido} </span>}
                      {p.pedidoNombre}
                    </h2>
                  </div>
                  <div className="mb-1 flex flex-wrap gap-1">
                    {p.condiciones.map((c) => (
                      <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span>
                      <strong>{surt}</strong> de <strong>{req}</strong> surtidas
                    </span>
                    {completado ? (
                      <span className="flex items-center gap-1 font-semibold text-success">
                        <Check className="h-3.5 w-3.5" /> Listo
                      </span>
                    ) : (
                      <span className="font-semibold">{pct}%</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      {marcas} {marcas === 1 ? 'marca' : 'marcas'}
                    </span>
                    {totalPallets > 0 && (
                      <span className="flex items-center gap-1">
                        <Box className="h-3 w-3" /> {totalPallets} {totalPallets === 1 ? 'pallet' : 'pallets'}
                      </span>
                    )}
                    {totalPiezas > 0 && <span>{totalPiezas} {totalPiezas === 1 ? 'pieza' : 'piezas'}</span>}
                    {p.fechaLimite && <span>Límite: {formatearFechaLimite(p.fechaLimite)}</span>}
                  </div>
                </a>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
