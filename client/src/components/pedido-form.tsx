// Formulario de captura/edición de pedido — puerto de
// app/components/pedido-form.jsx a TS + Tailwind. La lógica de negocio
// (cupo/límite, "sin límite", auto-uppercase de SKU) es la misma; cambia
// el sistema visual (CSS plano -> Tailwind) y el panel de import se
// conecta en la Fase 5 (por ahora el prop existe pero el panel real llega
// después).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { Plus, X, AlertCircle, ArrowRight, Package } from 'lucide-react'
import { MARCAS, PULGADAS, CONDICIONES, SKU_REGEX } from '@shared/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ImportarPedidoPanel from '@/components/importar-pedido-panel'

export type TvFormItem = {
  marca: string
  pulgadas: string
  modelo: string
  cantidad: number | ''
  unidad: 'pieza' | 'pallet'
  sinLimite: boolean
  modelosAlternativos: string[]
}

export type PedidoFormData = {
  numeroPedido: string
  pedidoNombre: string
  fechaLimite: string
  condiciones: string[]
  cantidadTotal: number | null
  televisiones: {
    marca: string
    pulgadas: number
    modelo: string
    cantidad: number
    unidad: 'pieza' | 'pallet'
    sinLimite: boolean
    modelosAlternativos: string[]
  }[]
}

const tvVacia = (): TvFormItem => ({
  marca: '',
  pulgadas: '',
  modelo: '',
  cantidad: 1,
  unidad: 'pieza',
  sinLimite: false,
  modelosAlternativos: [],
})

export type PedidoFormInitialData = {
  numeroPedido?: string
  pedidoNombre?: string
  fechaLimite?: string
  condiciones?: string[]
  cantidadTotal?: number | null
  televisiones?: {
    marca: string
    pulgadas: number
    modelo: string
    cantidad: number
    unidad: string
    sinLimite?: boolean
    modelosAlternativos?: string[]
  }[]
}

export default function PedidoForm({
  initialData,
  onSubmit,
  titulo = 'Nuevo pedido',
  subtitulo = 'Captura las TVs que se incluyen en este pedido.',
  submitLabel = 'Crear pedido',
  cancelHref,
}: {
  initialData?: PedidoFormInitialData
  onSubmit: (data: PedidoFormData) => Promise<void>
  titulo?: string
  subtitulo?: string
  submitLabel?: string
  cancelHref?: string
}) {
  const [numeroPedido, setNumeroPedido] = useState(initialData?.numeroPedido || '')
  const [pedidoNombre, setPedidoNombre] = useState(initialData?.pedidoNombre || '')
  const [fechaLimite, setFechaLimite] = useState(initialData?.fechaLimite || '')
  const [condiciones, setCondiciones] = useState<string[]>(initialData?.condiciones || [])
  const [cantidadTotal, setCantidadTotal] = useState(
    initialData?.cantidadTotal != null && initialData.cantidadTotal > 0 ? String(initialData.cantidadTotal) : ''
  )
  const [tvs, setTvs] = useState<TvFormItem[]>(
    initialData?.televisiones?.length
      ? initialData.televisiones.map((tv) => ({
          marca: tv.marca || '',
          pulgadas: tv.pulgadas !== undefined ? String(tv.pulgadas) : '',
          modelo: tv.modelo || '',
          cantidad: tv.cantidad || 1,
          unidad: (tv.unidad as 'pieza' | 'pallet') || 'pieza',
          sinLimite: Boolean(tv.sinLimite),
          modelosAlternativos: tv.modelosAlternativos || [],
        }))
      : [tvVacia()]
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const previousLength = useRef(tvs.length)

  useEffect(() => {
    if (tvs.length > previousLength.current) {
      const lastInput = inputRefs.current[tvs.length - 1]
      if (lastInput) {
        lastInput.focus()
        lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    previousLength.current = tvs.length
  }, [tvs.length])

  const limite = useMemo(() => {
    const n = Number(cantidadTotal)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [cantidadTotal])

  const cantidadParaSuma = (tv: TvFormItem) => (tv.sinLimite ? 0 : Number(tv.cantidad) || 0)

  const totalUnidades = useMemo(() => tvs.reduce((s, tv) => s + cantidadParaSuma(tv), 0), [tvs])
  const marcasUnicas = useMemo(() => new Set(tvs.map((tv) => tv.marca).filter(Boolean)).size, [tvs])
  const pallets = useMemo(
    () => tvs.reduce((s, tv) => s + (tv.unidad === 'pallet' ? cantidadParaSuma(tv) : 0), 0),
    [tvs]
  )
  const piezas = useMemo(
    () => tvs.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? cantidadParaSuma(tv) : 0), 0),
    [tvs]
  )

  const pedidoCerrado = limite > 0 && totalUnidades >= limite
  const pedidoExcedido = limite > 0 && totalUnidades > limite
  const progresoLimite = limite > 0 ? Math.min(100, Math.round((totalUnidades / limite) * 100)) : 0

  const toggleCondicion = (c: string) =>
    setCondiciones((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const updateTv = <K extends keyof TvFormItem>(i: number, campo: K, valor: TvFormItem[K]) =>
    setTvs((prev) => prev.map((tv, idx) => (idx === i ? { ...tv, [campo]: valor } : tv)))

  const updateCantidad = (i: number, raw: string) => {
    if (raw === '') {
      updateTv(i, 'cantidad', '')
      return
    }
    let valor = Number(raw)
    if (!Number.isFinite(valor) || valor < 0) valor = 0
    if (limite > 0) {
      const otrosTotal = tvs.reduce((s, t, idx) => (idx === i ? s : s + cantidadParaSuma(t)), 0)
      const maxPermitido = Math.max(0, limite - otrosTotal)
      if (valor > maxPermitido) valor = maxPermitido
    }
    updateTv(i, 'cantidad', valor)
  }

  const toggleSinLimiteTv = (i: number) =>
    setTvs((prev) =>
      prev.map((tv, idx) =>
        idx === i ? { ...tv, sinLimite: !tv.sinLimite, cantidad: !tv.sinLimite ? 1 : tv.cantidad || 1 } : tv
      )
    )

  const updateSku = (i: number, raw: string) => {
    const limpio = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
    updateTv(i, 'modelo', limpio)
  }

  const togglePallet = (i: number) =>
    setTvs((prev) =>
      prev.map((tv, idx) => (idx === i ? { ...tv, unidad: tv.unidad === 'pallet' ? 'pieza' : 'pallet' } : tv))
    )

  const agregarTv = () => {
    if (pedidoCerrado) return
    setTvs((prev) => [...prev, tvVacia()])
  }
  const eliminarTv = (i: number) => setTvs((prev) => prev.filter((_, idx) => idx !== i))

  const importarTvs = (items: { marca: string; pulgadas: number | ''; modelo: string; cantidad: number; unidad?: string; modelosAlternativos?: string[] }[]) => {
    if (pedidoCerrado || !items?.length) return
    const nuevas: TvFormItem[] = items.map((it) => ({
      marca: it.marca,
      pulgadas: it.pulgadas ? String(it.pulgadas) : '',
      modelo: it.modelo,
      cantidad: it.cantidad || 1,
      unidad: (it.unidad as 'pieza' | 'pallet') || 'pieza',
      sinLimite: false,
      modelosAlternativos: it.modelosAlternativos || [],
    }))
    setTvs((prev) => {
      const soloVacia = prev.length === 1 && !prev[0].marca && !prev[0].modelo
      return soloVacia ? nuevas : [...prev, ...nuevas]
    })
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!numeroPedido.trim()) return setError('Falta el número de pedido')
    if (!pedidoNombre.trim()) return setError('Falta el nombre del pedido')
    if (!fechaLimite) return setError('Falta la fecha límite')
    if (tvs.length === 0) return setError('Agrega al menos una televisión')

    for (const [i, tv] of tvs.entries()) {
      if (!(MARCAS as readonly string[]).includes(tv.marca)) return setError(`TV #${i + 1}: marca inválida`)
      if (!(PULGADAS as readonly number[]).includes(Number(tv.pulgadas))) return setError(`TV #${i + 1}: pulgadas inválidas`)
      if (!SKU_REGEX.test(tv.modelo || '')) {
        return setError(`TV #${i + 1}: captura el modelo / SKU (mín. 3 letras o números)`)
      }
      if (!tv.sinLimite && (!Number(tv.cantidad) || Number(tv.cantidad) < 1)) {
        return setError(`TV #${i + 1}: cantidad inválida`)
      }
    }

    if (limite > 0) {
      const haySinLimite = tvs.some((tv) => tv.sinLimite)
      if (totalUnidades > limite) {
        return setError(`La suma de cantidades (${totalUnidades}) excede la cantidad total del pedido (${limite}).`)
      }
      if (totalUnidades < limite && !haySinLimite) {
        return setError(`La suma de cantidades (${totalUnidades}) no coincide con la cantidad total del pedido (${limite}).`)
      }
    }

    setEnviando(true)
    try {
      await onSubmit({
        numeroPedido: numeroPedido.trim(),
        pedidoNombre: pedidoNombre.trim(),
        fechaLimite,
        condiciones,
        cantidadTotal: limite > 0 ? limite : null,
        televisiones: tvs.map((tv) => ({
          marca: tv.marca,
          pulgadas: Number(tv.pulgadas),
          modelo: tv.modelo.trim(),
          cantidad: tv.sinLimite ? (limite > 0 ? limite : 0) : Number(tv.cantidad),
          unidad: tv.unidad,
          sinLimite: !!tv.sinLimite,
          modelosAlternativos: tv.modelosAlternativos || [],
        })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setEnviando(false)
    }
  }

  const hayPallets = pallets > 0

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">{titulo}</h1>
        <p className="text-muted-foreground">{subtitulo}</p>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <form onSubmit={enviar} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="numeroPedido">Número de pedido</Label>
              <Input id="numeroPedido" value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder="Ej. 12345" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pedidoNombre">Nombre del pedido</Label>
              <Input id="pedidoNombre" value={pedidoNombre} onChange={(e) => setPedidoNombre(e.target.value)} placeholder="Ej. Pedido Jesica" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fechaLimite">Fecha límite</Label>
              <Input id="fechaLimite" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cantidadTotal">
                Cantidad total del pedido <span className="text-xs text-muted-foreground">(vacío = sin límite)</span>
              </Label>
              <Input
                id="cantidadTotal"
                type="number"
                min={1}
                step={1}
                value={cantidadTotal}
                onChange={(e) => setCantidadTotal(e.target.value)}
                placeholder="Ej. 100"
              />
            </div>
          </div>

          {limite > 0 && (
            <div className={`rounded-md border p-3 ${pedidoExcedido ? 'border-destructive bg-destructive/10' : pedidoCerrado ? 'border-success bg-success/10' : 'bg-secondary'}`}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>
                  {totalUnidades} <span className="font-normal text-muted-foreground">de</span> {limite}
                </span>
                <span>{progresoLimite}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progresoLimite}%` }} />
              </div>
              {pedidoCerrado && !pedidoExcedido && <p className="mt-1 text-xs">Pedido completo · no se pueden agregar más TVs</p>}
              {pedidoExcedido && <p className="mt-1 text-xs text-destructive">Excedido por {totalUnidades - limite}. Reduce cantidades o aumenta el total.</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label>Condiciones</Label>
            <div className="flex flex-wrap gap-2">
              {CONDICIONES.map((c) => (
                <label
                  key={c}
                  className={`min-h-11 cursor-pointer select-none rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    condiciones.includes(c) ? 'border-primary bg-primary text-primary-foreground' : 'bg-secondary'
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={condiciones.includes(c)} onChange={() => toggleCondicion(c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Televisiones</h2>
              <span className="text-sm text-muted-foreground">
                {tvs.length} {tvs.length === 1 ? 'agregada' : 'agregadas'}
              </span>
            </div>

            {!pedidoCerrado && <ImportarPedidoPanel onImportar={importarTvs} />}

            <datalist id="marcas-list">
              {MARCAS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            {tvs.map((tv, i) => {
              const esPallet = tv.unidad === 'pallet'
              const esSinLimite = tv.sinLimite
              const otrosTotal = tvs.reduce((s, t, idx) => (idx === i ? s : s + cantidadParaSuma(t)), 0)
              const maxCantidad = limite > 0 ? Math.max(0, limite - otrosTotal) : undefined
              return (
                <div
                  key={i}
                  className={`rounded-md border p-3 ${esPallet ? 'border-accent bg-accent/10' : ''} ${esSinLimite ? 'border-primary' : ''}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-muted-foreground">TV #{i + 1}</span>
                    <label className="flex min-h-11 cursor-pointer items-center gap-1">
                      <input type="checkbox" checked={esPallet} onChange={() => togglePallet(i)} />
                      <Package className="h-4 w-4" /> Pallet
                    </label>
                    <label className={`flex min-h-11 cursor-pointer items-center gap-1 ${esSinLimite ? 'font-semibold text-primary' : ''}`}>
                      <input type="checkbox" checked={esSinLimite} onChange={() => toggleSinLimiteTv(i)} />
                      <span aria-hidden="true">∞</span> Sin límite
                    </label>
                    {tvs.length > 1 && (
                      <button type="button" onClick={() => eliminarTv(i)} className="ml-auto flex min-h-11 items-center gap-1 text-destructive">
                        <X className="h-3.5 w-3.5" /> Quitar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      ref={(el) => {
                        inputRefs.current[i] = el
                      }}
                      value={tv.modelo}
                      onChange={(e) => updateSku(i, e.target.value)}
                      placeholder="SKU / Modelo"
                      minLength={3}
                      maxLength={20}
                      required
                    />
                    <Input list="marcas-list" value={tv.marca} onChange={(e) => updateTv(i, 'marca', e.target.value)} placeholder="Marca" required />
                    <select
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={tv.pulgadas}
                      onChange={(e) => updateTv(i, 'pulgadas', e.target.value)}
                      required
                    >
                      <option value="">Pulgadas</option>
                      {PULGADAS.map((p) => (
                        <option key={p} value={p}>
                          {p}&quot;
                        </option>
                      ))}
                    </select>
                    {esSinLimite ? (
                      <div className="flex h-11 items-center justify-center rounded-md border bg-secondary text-sm font-semibold">
                        {limite > 0 ? `${limite} (total del pedido)` : '∞ sin límite'}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        max={maxCantidad}
                        value={tv.cantidad}
                        onChange={(e) => updateCantidad(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && i === tvs.length - 1) {
                            e.preventDefault()
                            agregarTv()
                          }
                        }}
                        placeholder={esPallet ? 'Pallets' : 'Cant.'}
                        required
                      />
                    )}
                  </div>
                  {tv.modelosAlternativos?.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">También válido: {tv.modelosAlternativos.join(', ')}</p>
                  )}
                </div>
              )
            })}

            <Button type="button" variant="secondary" onClick={agregarTv} disabled={pedidoCerrado} className="w-full">
              <Plus className="h-4 w-4" />
              {pedidoCerrado ? 'Pedido completo' : 'Agregar televisión'}
            </Button>
          </div>

          {totalUnidades > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border p-2 text-center">
                <div className="text-xl font-bold">{tvs.length}</div>
                <div className="text-xs text-muted-foreground">Modelos</div>
              </div>
              <div className="rounded-md border p-2 text-center">
                <div className="text-xl font-bold">{marcasUnicas}</div>
                <div className="text-xs text-muted-foreground">Marcas</div>
              </div>
              {hayPallets ? (
                <>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xl font-bold">{pallets}</div>
                    <div className="text-xs text-muted-foreground">Pallets</div>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xl font-bold">{piezas}</div>
                    <div className="text-xs text-muted-foreground">Piezas</div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border p-2 text-center">
                  <div className="text-xl font-bold">{limite > 0 ? limite : piezas}</div>
                  <div className="text-xs text-muted-foreground">TVs totales</div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {cancelHref && (
              <Link href={cancelHref}>
                <Button type="button" variant="secondary" size="lg">
                  Cancelar
                </Button>
              </Link>
            )}
            <Button type="submit" size="lg" disabled={enviando}>
              {enviando ? 'Guardando…' : (
                <>
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
