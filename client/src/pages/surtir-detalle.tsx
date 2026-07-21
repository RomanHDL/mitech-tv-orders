// Puerto de app/surtir/[id]/surtir-cliente.jsx — captura de avance por TV
// con autosave, rollback en error y undo toast. El PATCH ahora referencia
// la fila por id (pedido_televisiones.id), no por índice de array.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Box, Check, Minus, Plus, Printer, RefreshCw } from 'lucide-react'
import { apiRequest, ApiError } from '@/lib/queryClient'
import { useAuth } from '@/hooks/use-auth'
import ComentariosPedido from '@/components/comentarios-pedido'
import StepperEtapas from '@/components/pedidos/stepper-etapas'
import { normalizeOrderStatus } from '@/lib/pedido-stats'
import { unidadLabel, ESTADO_LABEL, type PedidoConTvs, type TelevisionRow, type PedidoEstadoLogRow, type EstadoOperativo } from '@shared/schema'

type PedidoDetalle = PedidoConTvs & { historialEstados?: PedidoEstadoLogRow[] }

// Próxima etapa accionable — mismo helper que la tabla de /pedidos.
function proximaEtapa(estado: EstadoOperativo): { destino: EstadoOperativo; label: string } | null {
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO') {
    return { destino: 'CARGANDO', label: 'Iniciar carga' }
  }
  if (estado === 'CARGANDO') return { destino: 'LISTO_SALIDA', label: 'Marcar listo para salida' }
  if (estado === 'LISTO_SALIDA') return { destino: 'DESPACHADO', label: 'Confirmar despacho' }
  return null
}

function agruparPorMarca(televisiones: TelevisionRow[]) {
  const grupos: Record<string, TelevisionRow[]> = {}
  for (const tv of televisiones) {
    if (!grupos[tv.marca]) grupos[tv.marca] = []
    grupos[tv.marca].push(tv)
  }
  return Object.keys(grupos)
    .sort()
    .map((marca) => ({ marca, items: [...grupos[marca]].sort((a, b) => a.pulgadas - b.pulgadas) }))
}

type UltimaAccion = { tvId: string; valorAnterior: number; label: string } | null

export default function SurtirDetalle() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: pedido, isLoading } = useQuery<PedidoDetalle>({ queryKey: [`/api/pedidos/${id}`] })

  const [tvs, setTvs] = useState<TelevisionRow[]>([])
  const [error, setError] = useState('')
  const [estadoGuardado, setEstadoGuardado] = useState<'idle' | 'guardando' | 'guardado' | 'error'>('idle')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const [ultimaAccion, setUltimaAccion] = useState<UltimaAccion>(null)
  const guardadoTimeout = useRef<ReturnType<typeof setTimeout>>()
  const undoTimeout = useRef<ReturnType<typeof setTimeout>>()
  const enVuelo = useRef(0)
  const valoresServidor = useRef<Record<string, number>>({})

  useEffect(() => {
    if (pedido) {
      setTvs(pedido.televisiones)
      valoresServidor.current = Object.fromEntries(pedido.televisiones.map((tv) => [tv.id, tv.cantidadSurtida]))
    }
  }, [pedido])

  useEffect(
    () => () => {
      clearTimeout(guardadoTimeout.current)
      clearTimeout(undoTimeout.current)
    },
    []
  )

  const grupos = useMemo(() => agruparPorMarca(tvs), [tvs])

  const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
  const totalRequerido = typeof pedido?.cantidadTotal === 'number' && pedido.cantidadTotal > 0 ? pedido.cantidadTotal : sumaCantidades
  const totalSurtido = tvs.reduce((s, tv) => {
    const surt = tv.cantidadSurtida || 0
    if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
    return s + Math.min(tv.cantidad || 0, surt)
  }, 0)
  const progreso = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
  const completado = totalRequerido > 0 && totalSurtido >= totalRequerido
  const pendienteCantidad = Math.max(0, totalRequerido - totalSurtido)

  const estado = normalizeOrderStatus({ progresoPct: progreso, estadoOperativo: pedido?.estadoOperativo ?? null })
  const puedeAvanzarEtapa = usuario?.rol === 'admin' || usuario?.rol === 'surtidor'
  const siguienteEtapa = proximaEtapa(estado)
  const puedeCancelar = estado !== 'DESPACHADO' && estado !== 'CANCELADO'

  async function avanzarEtapa(destino: EstadoOperativo) {
    setErrorEstado('')
    let razon: string | null = null

    if (destino === 'DESPACHADO') {
      if (!confirm('¿Confirmas que este pedido ya salió de las instalaciones?')) return
      if (pendienteCantidad > 0) {
        if (usuario?.rol !== 'admin') {
          setErrorEstado('No se puede despachar con unidades pendientes.')
          return
        }
        razon = window.prompt('Este pedido tiene unidades pendientes. Escribe la razón para despachar de todos modos:')
        if (!razon || !razon.trim()) return
      }
    }
    if (destino === 'CANCELADO' && !confirm('¿Confirmas que quieres cancelar este pedido?')) return

    setCambiandoEstado(true)
    try {
      await apiRequest('PATCH', `/api/pedidos/${id}/estado`, { estado: destino, razon })
      await queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${id}`] })
    } catch (err) {
      setErrorEstado(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setCambiandoEstado(false)
    }
  }

  const registrarUndo = (accion: UltimaAccion) => {
    clearTimeout(undoTimeout.current)
    setUltimaAccion(accion)
    undoTimeout.current = setTimeout(() => setUltimaAccion(null), 6000)
  }

  const deshacer = () => {
    if (!ultimaAccion) return
    clearTimeout(undoTimeout.current)
    const accion = ultimaAccion
    setUltimaAccion(null)
    actualizar(accion.tvId, accion.valorAnterior, { esUndo: true })
  }

  async function actualizar(tvId: string, valorBruto: number, opciones: { esUndo?: boolean; descripcion?: string } = {}) {
    const tv = tvs.find((x) => x.id === tvId)
    if (!tv) return
    const limiteTv = tv.sinLimite ? Infinity : tv.cantidad
    const valor = Math.max(0, Math.min(limiteTv, Number(valorBruto) || 0))
    const valorAnterior = tv.cantidadSurtida || 0
    if (valor === valorAnterior) return

    setTvs((prev) => prev.map((x) => (x.id === tvId ? { ...x, cantidadSurtida: valor } : x)))

    if (!opciones.esUndo) {
      const delta = valor - valorAnterior
      const signo = delta > 0 ? '+' : ''
      const desc = opciones.descripcion || t('surtirDetalle.estaTv')
      registrarUndo({ tvId, valorAnterior, label: t('surtirDetalle.undoLabel', { signo, delta, desc, valor, cantidad: tv.cantidad }) })
    }

    enVuelo.current += 1
    setEstadoGuardado('guardando')
    clearTimeout(guardadoTimeout.current)

    try {
      await apiRequest('PATCH', `/api/pedidos/${id}/televisiones/${tvId}`, { cantidadSurtida: valor })
      valoresServidor.current[tvId] = valor
      setError('')
      enVuelo.current -= 1
      if (enVuelo.current === 0) {
        setEstadoGuardado('guardado')
        guardadoTimeout.current = setTimeout(() => setEstadoGuardado('idle'), 2200)
      }
    } catch (err) {
      enVuelo.current -= 1
      const valorPrevio = valoresServidor.current[tvId] ?? 0
      setTvs((prev) => prev.map((x) => (x.id === tvId ? { ...x, cantidadSurtida: valorPrevio } : x)))
      setError(err instanceof ApiError ? err.message : t('common.errGuardar'))
      setEstadoGuardado('error')
    }
  }

  if (isLoading) return null
  if (!pedido) return <main className="p-6">{t('surtirDetalle.noEncontrado')}</main>

  // Guardia de UX: capturista solo debe abrir lo suyo (la restricción real,
  // que importa, es server-side en el PATCH de surtido).
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.id) {
    return <main className="p-6">{t('surtirDetalle.noAutorizado')}</main>
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/surtir">
            <a className="inline-flex min-h-9 items-center gap-1 rounded-md border bg-secondary px-3 py-1.5 text-sm">
              <ArrowLeft className="h-3.5 w-3.5" /> {t('common.volver')}
            </a>
          </Link>
          <Link href={`/pedidos/${pedido.id}/imprimir`}>
            <a className="inline-flex min-h-9 items-center gap-1 rounded-md border bg-secondary px-3 py-1.5 text-sm">
              <Printer className="h-3.5 w-3.5" /> {t('common.imprimir')}
            </a>
          </Link>
          {estadoGuardado !== 'idle' && (
            <span className="text-xs text-muted-foreground">
              {estadoGuardado === 'guardando' && t('common.guardando')}
              {estadoGuardado === 'guardado' && t('common.guardadoCheck')}
              {estadoGuardado === 'error' && t('common.errorGuardadoIcono')}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl text-primary">
          {pedido.numeroPedido ? `#${pedido.numeroPedido} — ` : ''}
          {pedido.pedidoNombre}
        </h1>

        {pedido.condiciones.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pedido.condiciones.map((c) => (
              <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className={`rounded-md border p-3 ${completado ? 'border-success bg-success/10' : ''}`}>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>{t('surtirDetalle.deSurtidas', { surt: totalSurtido, req: totalRequerido })}</span>
            <span>{progreso}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progreso}%` }} />
          </div>
          {completado && (
            <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-success">
              <Check className="h-4 w-4" /> {t('surtirDetalle.pedidoCompleto')}
            </div>
          )}
        </div>
      </header>

      <div className="mb-4 rounded-md border bg-secondary/30 p-3.5">
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ciclo del pedido</h3>
        <StepperEtapas estado={estado} />

        {puedeAvanzarEtapa && (siguienteEtapa || puedeCancelar) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {siguienteEtapa && (
              <button
                type="button"
                onClick={() => avanzarEtapa(siguienteEtapa.destino)}
                disabled={cambiandoEstado}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {siguienteEtapa.label}
              </button>
            )}
            {puedeCancelar && (
              <button
                type="button"
                onClick={() => avanzarEtapa('CANCELADO')}
                disabled={cambiandoEstado}
                className="inline-flex h-9 items-center rounded-md border border-destructive px-3 text-sm font-semibold text-destructive disabled:opacity-50"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        )}

        {errorEstado && <div className="mt-2 text-sm font-semibold text-destructive">{errorEstado}</div>}

        {pedido.historialEstados && pedido.historialEstados.length > 0 && (
          <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
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
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ComentariosPedido
        pedidoId={pedido.id}
        comentariosIniciales={pedido.comentarios || ''}
        actualizadoIso={pedido.comentariosActualizado ? new Date(pedido.comentariosActualizado).toISOString() : null}
        actualizadoPorNombre={pedido.comentariosActualizadoPorNombre}
      />

      <div className="mt-4 space-y-4">
        {grupos.map(({ marca, items }) => (
          <section key={marca}>
            <h2 className="mb-1 border-b-2 border-foreground pb-1 text-lg font-bold">{marca.toUpperCase()}</h2>
            <div className="space-y-2">
              {items.map((tv) => {
                const esSinLimite = tv.sinLimite
                const surtida = esSinLimite ? tv.cantidadSurtida || 0 : Math.min(tv.cantidad, tv.cantidadSurtida || 0)
                const completo = !esSinLimite && surtida >= tv.cantidad
                const enProgreso = surtida > 0 && !completo
                const esPallet = tv.unidad === 'pallet'
                const descTv = `${marca} ${tv.pulgadas}"${tv.condicion ? ' ' + tv.condicion : ''}${tv.modelo ? ' ' + tv.modelo : ''}`
                const unidadTxt = unidadLabel(tv.cantidad || 1, tv.unidad)

                return (
                  <div
                    key={tv.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                      completo ? 'border-success bg-success/5' : enProgreso ? 'border-accent bg-accent/5' : ''
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">{tv.pulgadas}&quot;</span>
                        {tv.condicion && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">{tv.condicion}</span>
                        )}
                        {esPallet && (
                          <span className="flex items-center gap-1 rounded bg-accent/30 px-1.5 py-0.5 text-xs font-semibold">
                            <Box className="h-3 w-3" /> {t('pedidoForm.pallet')}
                          </span>
                        )}
                        {tv.modelo && <span className="font-mono text-sm">{tv.modelo}</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {esSinLimite ? <strong>{t('pedidoForm.sinLimite')}</strong> : <><strong>{tv.cantidad}</strong> {unidadLabel(tv.cantidad, tv.unidad)}</>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={esSinLimite ? undefined : tv.cantidad}
                          value={surtida}
                          onChange={(e) => actualizar(tv.id, Number(e.target.value), { descripcion: descTv })}
                          aria-label={t('surtirDetalle.cantidadSurtida')}
                          className="h-10 w-16 rounded-md border border-input bg-background px-2 text-center"
                        />
                        <span className="text-sm text-muted-foreground">{esSinLimite ? '/ ∞' : `/ ${tv.cantidad}`}</span>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('surtirDetalle.confirmarRestar', { unidad: unidadTxt, desc: descTv, resultado: surtida - 1, cantidad: tv.cantidad })))
                              actualizar(tv.id, surtida - 1, { descripcion: descTv })
                          }}
                          disabled={surtida === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-40"
                          aria-label={t('surtirDetalle.restarUno')}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('surtirDetalle.confirmarSumar', { unidad: unidadTxt, desc: descTv, resultado: surtida + 1, cantidad: tv.cantidad })))
                              actualizar(tv.id, surtida + 1, { descripcion: descTv })
                          }}
                          disabled={completo}
                          className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-40"
                          aria-label={t('surtirDetalle.sumarUno')}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (esSinLimite) return
                            const restantes = tv.cantidad - surtida
                            if (confirm(t('surtirDetalle.confirmarMarcarTodas', { restantes, unidad: unidadTxt, desc: descTv, cantidad: tv.cantidad })))
                              actualizar(tv.id, tv.cantidad, { descripcion: descTv })
                          }}
                          disabled={completo || esSinLimite}
                          className="flex h-9 w-9 items-center justify-center rounded-md border bg-success/10 text-success disabled:opacity-40"
                          aria-label={t('surtirDetalle.marcarTodas')}
                          title={esSinLimite ? t('surtirDetalle.noAplicaSinLimite') : t('surtirDetalle.marcarTodas')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('surtirDetalle.confirmarReiniciar', { desc: descTv, surtida, unidad: unidadTxt }))) actualizar(tv.id, 0, { descripcion: descTv })
                          }}
                          disabled={surtida === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-40"
                          aria-label={t('surtirDetalle.reiniciar')}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {ultimaAccion && (
        <div className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-96" role="status">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-success" />
            <span>{ultimaAccion.label}</span>
          </div>
          <button type="button" onClick={deshacer} className="shrink-0 rounded-md border px-2 py-1 text-sm font-semibold">
            {t('common.deshacer')}
          </button>
        </div>
      )}
    </main>
  )
}
