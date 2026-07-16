// Puerto de app/admin/catalogo-onn/catalogo-cliente.jsx — CRUD del
// catálogo modelo ONN -> pulgadas usado para autollenar el import en lote.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Search, Trash2 } from 'lucide-react'
import { apiRequest, ApiError } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PULGADAS } from '@shared/schema'

type CatalogoItem = { id: string; modelo: string; pulgadas: number }

const limpiarModelo = (raw: string) => raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()

export default function AdminCatalogoOnn() {
  const queryClient = useQueryClient()
  const { data: items = [], isLoading } = useQuery<CatalogoItem[]>({ queryKey: ['/api/catalogo-onn'] })

  const [modelo, setModelo] = useState('')
  const [pulgadas, setPulgadas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['/api/catalogo-onn'] })

  const agregarMutation = useMutation({
    mutationFn: async (body: { modelo: string; pulgadas: number }) => apiRequest('POST', '/api/catalogo-onn', body),
    onSuccess: invalidar,
  })
  const editarMutation = useMutation({
    mutationFn: async ({ id, pulgadas: p }: { id: string; pulgadas: number }) => apiRequest('PATCH', `/api/catalogo-onn/${id}`, { pulgadas: p }),
    onSuccess: invalidar,
  })
  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/catalogo-onn/${id}`),
    onSuccess: invalidar,
  })

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase()
    if (!q) return items
    return items.filter((it) => it.modelo.includes(q))
  }, [items, busqueda])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setExito('')
    const m = limpiarModelo(modelo)
    if (m.length < 3) return setError('Captura el código del modelo (mín. 3 caracteres)')
    if (!pulgadas) return setError('Elige la pulgada')
    try {
      await agregarMutation.mutateAsync({ modelo: m, pulgadas: Number(pulgadas) })
      setExito(`${m} → ${pulgadas}" agregado`)
      setModelo('')
      setPulgadas('')
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
    }
  }

  async function cambiarPulgada(it: CatalogoItem, nueva: string) {
    setGuardandoId(it.id)
    setError('')
    try {
      await editarMutation.mutateAsync({ id: it.id, pulgadas: Number(nueva) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar')
    } finally {
      setGuardandoId(null)
    }
  }

  async function eliminar(it: CatalogoItem) {
    if (!confirm(`¿Eliminar ${it.modelo} del catálogo?`)) return
    setGuardandoId(it.id)
    setError('')
    try {
      await eliminarMutation.mutateAsync(it.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar')
    } finally {
      setGuardandoId(null)
    }
  }

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Catálogo ONN</h1>
        <p className="text-muted-foreground">Asocia cada código ONN con su pulgada. Al importar un pedido, los ONN de esta lista se llenan solos.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Agregar código</h2>
          <form onSubmit={agregar} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="c-modelo">Código ONN</Label>
              <Input id="c-modelo" value={modelo} onChange={(e) => setModelo(limpiarModelo(e.target.value))} placeholder="Ej. 100012585" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-pulgadas">Pulgadas</Label>
              <select
                id="c-pulgadas"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={pulgadas}
                onChange={(e) => setPulgadas(e.target.value)}
                required
              >
                <option value="">Elige pulgada</option>
                {PULGADAS.map((p) => (
                  <option key={p} value={p}>
                    {p}&quot;
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> <span>{error}</span>
              </div>
            )}
            {exito && (
              <div className="flex items-center gap-2 rounded-md border border-success bg-success/10 p-2 text-sm text-success">
                <Check className="h-4 w-4 shrink-0" /> <span>{exito}</span>
              </div>
            )}

            <Button type="submit" disabled={agregarMutation.isPending} className="w-full">
              {agregarMutation.isPending ? 'Guardando…' : 'Agregar al catálogo'}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Códigos guardados ({items.length})</h2>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar código…" className="pl-9" />
          </div>

          {filtrados.length === 0 ? (
            <p className="text-muted-foreground">{items.length === 0 ? 'No hay códigos todavía.' : 'Sin resultados.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">Código ONN</th>
                    <th className="p-2">Pulgadas</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((it) => (
                    <tr key={it.id} className="border-b">
                      <td className="p-2 font-mono font-semibold">{it.modelo}</td>
                      <td className="p-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={it.pulgadas}
                          disabled={guardandoId === it.id}
                          onChange={(e) => cambiarPulgada(it, e.target.value)}
                        >
                          {PULGADAS.map((p) => (
                            <option key={p} value={p}>
                              {p}&quot;
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="destructive" disabled={guardandoId === it.id} onClick={() => eliminar(it)}>
                          <Trash2 className="h-3.5 w-3.5" /> {guardandoId === it.id ? '…' : 'Eliminar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
