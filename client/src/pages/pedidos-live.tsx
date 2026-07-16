// Puerto de app/pedidos-live/page.jsx + pedidos-live-cliente.jsx — pedidos
// en vivo del WMS (SQL Server BinManagerRO), solo admin. Búsqueda client-
// side + detalle expandible con drill-down de pallets (lazy, se consulta
// solo al abrir la fila).
import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, ApiError } from '@/lib/queryClient'

type PedidoLive = {
  orderId: number
  webOrderId: string
  source: string
  accountName: string
  cliente: string
  estatus: string
  moneda: string
  total: number | null
  fecha: string | null
  ubicacion: string
}

type ItemLive = {
  orderItemsId: number
  sku: string | null
  itemDescription: string | null
  qty: number | null
  binCode: string | null
  ultimoMovimiento: { tipoMovimiento: string; movidoPor: string; fecha: string | null } | null
}

type DetalleEstado = { cargando: boolean; error?: string; items?: ItemLive[] }

function claseEstatus(estatus: string) {
  const e = (estatus || '').toLowerCase()
  if (e.includes('cancel')) return 'bg-destructive/15 text-destructive'
  if (e.includes('not stock') || e.includes('oversold') || e.includes('not found') || e.includes('unmapped')) return 'bg-destructive/15 text-destructive'
  if (e.includes('shipped') || e.includes('send -')) return 'bg-success/15 text-success'
  if (e.includes('ready')) return 'bg-accent/30'
  if (e.includes('pick') || e.includes('multiple') || e.includes('assign') || e.includes('above')) return 'bg-accent/20'
  return 'bg-secondary'
}

function formatMoneda(total: number | null, moneda: string) {
  if (total === null || total === undefined) return '—'
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(total)
  } catch {
    return `${total} ${moneda || ''}`.trim()
  }
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(fecha)
}

export default function PedidosLive() {
  const { data: pedidos = [], isLoading, error } = useQuery<PedidoLive[]>({ queryKey: ['/api/pedidos-live'] })
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Record<number, DetalleEstado>>({})

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter(
      (p) => String(p.orderId).includes(q) || p.webOrderId.toLowerCase().includes(q) || p.accountName.toLowerCase().includes(q) || p.source.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q)
    )
  }, [pedidos, busqueda])

  async function toggleDetalle(orderId: number) {
    if (abiertoId === orderId) {
      setAbiertoId(null)
      return
    }
    setAbiertoId(orderId)
    if (detalle[orderId]) return

    setDetalle((prev) => ({ ...prev, [orderId]: { cargando: true } }))
    try {
      const res = await apiRequest('GET', `/api/pedidos-live/${orderId}`)
      const data = await res.json()
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, items: data.items || [] } }))
    } catch (err) {
      setDetalle((prev) => ({ ...prev, [orderId]: { cargando: false, error: err instanceof ApiError ? err.message : 'No se pudo cargar el detalle' } }))
    }
  }

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Pedidos en vivo (WMS)</h1>
        <p className="text-muted-foreground">
          {error ? 'No se pudo conectar al WMS.' : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} · datos en tiempo real`}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : 'No se pudo conectar al WMS'}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="relative mb-3 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por N° pedido, cuenta, cliente o marketplace…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
          </div>

          {pedidosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No se encontraron pedidos con &quot;{busqueda}&quot;.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">Pedido</th>
                    <th className="p-2">Marketplace</th>
                    <th className="p-2">Cuenta</th>
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Estatus</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Ubicación</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((p) => {
                    const d = detalle[p.orderId]
                    const abierto = abiertoId === p.orderId
                    return (
                      <Fragment key={p.orderId}>
                        <tr className="border-b">
                          <td className="p-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">#{p.orderId}</span>
                              {p.webOrderId && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{p.webOrderId}</span>}
                            </div>
                          </td>
                          <td className="p-2">{p.source || '—'}</td>
                          <td className="p-2">{p.accountName || '—'}</td>
                          <td className="p-2">{p.cliente || '—'}</td>
                          <td className="p-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${claseEstatus(p.estatus)}`}>{p.estatus}</span>
                          </td>
                          <td className="p-2 font-semibold whitespace-nowrap">{formatMoneda(p.total, p.moneda)}</td>
                          <td className="p-2 whitespace-nowrap">{formatFecha(p.fecha)}</td>
                          <td className="p-2">{p.ubicacion || '—'}</td>
                          <td className="p-2">
                            <Button size="sm" variant="secondary" onClick={() => toggleDetalle(p.orderId)}>
                              <Box className="h-3.5 w-3.5" /> {abierto ? 'Ocultar' : 'Ver'}
                            </Button>
                          </td>
                        </tr>
                        {abierto && (
                          <tr className="border-b bg-secondary/40">
                            <td colSpan={9} className="p-3">
                              {!d || d.cargando ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="h-4 w-4 animate-spin" /> Cargando detalle del pedido…
                                </p>
                              ) : d.error ? (
                                <p className="text-sm text-destructive">{d.error}</p>
                              ) : d.items && d.items.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin artículos registrados para este pedido.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="p-1">SKU</th>
                                      <th className="p-1">Descripción</th>
                                      <th className="p-1">Cant.</th>
                                      <th className="p-1">Pallet</th>
                                      <th className="p-1">Último movimiento</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.items?.map((it) => (
                                      <tr key={it.orderItemsId} className="border-t">
                                        <td className="p-1">{it.sku || '—'}</td>
                                        <td className="p-1">{it.itemDescription || '—'}</td>
                                        <td className="p-1">{it.qty ?? '—'}</td>
                                        <td className="p-1">{it.binCode || '—'}</td>
                                        <td className="p-1">
                                          {it.ultimoMovimiento ? `${it.ultimoMovimiento.tipoMovimiento} · ${it.ultimoMovimiento.movidoPor} (${formatFecha(it.ultimoMovimiento.fecha)})` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
