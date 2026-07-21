// Puerto de app/pedidos/page.jsx + lista-cliente.jsx — lista con búsqueda,
// filtros, orden, paginación local, export Excel, reasignar dueño (admin) y
// print/editar/eliminar. Se convirtió en un orquestador delgado: la UI vive
// en client/src/components/pedidos/*, este archivo solo trae los datos
// reales (queries/mutations, sin tocar sus endpoints) y arma el filtrado.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'
import { useAuth } from '@/hooks/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { descargarPedidosXLSX } from '@/lib/exportar-pedidos'
import { estaVencido, normalizeOrderStatus, progresoPct, totalRequerido, totalSurtido } from '@/lib/pedido-stats'
import PedidosHeader from '@/components/pedidos/pedidos-header'
import PedidosToolbar, { type EstadoFiltro, type OrdenarPor } from '@/components/pedidos/pedidos-toolbar'
import PedidosStats from '@/components/pedidos/pedidos-stats'
import PedidosEmptyState from '@/components/pedidos/pedidos-empty-state'
import PedidosTable, { type UsuarioAsignable } from '@/components/pedidos/pedidos-table'
import PedidosPagination from '@/components/pedidos/pedidos-pagination'
import type { PedidoConTvs } from '@shared/schema'

const POR_PAGINA = 10

export default function Pedidos() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const esAdmin = usuario?.rol === 'admin'

  const { data: pedidos = [], isLoading } = useQuery<PedidoConTvs[]>({ queryKey: ['/api/pedidos'] })
  const { data: usuarios = [] } = useQuery<UsuarioAsignable[]>({
    queryKey: ['/api/usuarios/asignables'],
    enabled: esAdmin,
  })

  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebouncedValue(busqueda, 300)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>('recientes')
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState('')
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [asignandoId, setAsignandoId] = useState<string | null>(null)

  const pedidosFiltrados = useMemo(() => {
    const q = busquedaDebounced.trim().toLowerCase()

    const filtrados = pedidos.filter((p) => {
      if (q) {
        const coincide =
          p.pedidoNombre.toLowerCase().includes(q) ||
          (p.numeroPedido || '').toLowerCase().includes(q) ||
          p.condiciones.some((c) => c.toLowerCase().includes(q)) ||
          p.televisiones.some((tv) => tv.modelo.toLowerCase().includes(q))
        if (!coincide) return false
      }
      if (estadoFiltro === 'VENCIDOS') {
        const pendiente = totalRequerido(p) - totalSurtido(p.televisiones)
        if (!estaVencido({ progresoPct: progresoPct(p), estadoOperativo: p.estadoOperativo, pendiente, fechaLimite: p.fechaLimite })) return false
      } else if (estadoFiltro !== 'todos') {
        const estado = normalizeOrderStatus({ progresoPct: progresoPct(p), estadoOperativo: p.estadoOperativo })
        if (estado !== estadoFiltro) return false
      }
      if (fechaDesde && new Date(p.fecha) < new Date(fechaDesde)) return false
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        if (new Date(p.fecha) > hasta) return false
      }
      return true
    })

    return [...filtrados].sort((a, b) => {
      switch (ordenarPor) {
        case 'antiguos':
          return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        case 'fechaLimite':
          return (a.fechaLimite || '').localeCompare(b.fechaLimite || '')
        case 'nombre':
          return a.pedidoNombre.localeCompare(b.pedidoNombre)
        case 'cantidad':
          return totalRequerido(b) - totalRequerido(a)
        case 'recientes':
        default:
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      }
    })
  }, [pedidos, busquedaDebounced, estadoFiltro, fechaDesde, fechaHasta, ordenarPor])

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const pedidosPagina = pedidosFiltrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

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
    if (!confirm(t('pedidos.confirmarEliminar', { nombre }))) return
    setError('')
    setEliminandoId(id)
    try {
      await eliminarMutation.mutateAsync(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pedidos.errEliminar'))
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
      setError(err instanceof Error ? err.message : t('pedidos.errAsignarDueno'))
    } finally {
      setAsignandoId(null)
    }
  }

  function limpiarFiltros() {
    setBusqueda('')
    setEstadoFiltro('todos')
    setFechaDesde('')
    setFechaHasta('')
    setOrdenarPor('recientes')
    setPagina(1)
  }

  if (isLoading) return null

  return (
    <main className="w-full pb-10 pt-8" style={{ paddingInline: 'clamp(20px, 2vw, 32px)' }}>
      <PedidosHeader />

      <PedidosToolbar
        busqueda={busqueda}
        onBusquedaChange={(v) => {
          setBusqueda(v)
          setPagina(1)
        }}
        estado={estadoFiltro}
        onEstadoChange={(v) => {
          setEstadoFiltro(v)
          setPagina(1)
        }}
        fechaDesde={fechaDesde}
        onFechaDesdeChange={(v) => {
          setFechaDesde(v)
          setPagina(1)
        }}
        fechaHasta={fechaHasta}
        onFechaHastaChange={(v) => {
          setFechaHasta(v)
          setPagina(1)
        }}
        ordenarPor={ordenarPor}
        onOrdenarPorChange={(v) => {
          setOrdenarPor(v)
          setPagina(1)
        }}
        onExportarExcel={() => descargarPedidosXLSX(pedidosFiltrados)}
        exportarDeshabilitado={pedidosFiltrados.length === 0}
      />

      <PedidosStats pedidos={pedidos} />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pedidos.length === 0 ? (
        <PedidosEmptyState variante="sinDatos" />
      ) : pedidosFiltrados.length === 0 ? (
        <PedidosEmptyState variante="sinResultados" onLimpiarFiltros={limpiarFiltros} />
      ) : (
        <>
          <PedidosTable
            pedidos={pedidosPagina}
            esAdmin={esAdmin}
            rol={usuario?.rol}
            usuarios={usuarios}
            asignandoId={asignandoId}
            eliminandoId={eliminandoId}
            onCambiarDueno={cambiarDueno}
            onEliminar={eliminar}
          />
          <PedidosPagination
            desde={(paginaSegura - 1) * POR_PAGINA + 1}
            hasta={Math.min(paginaSegura * POR_PAGINA, pedidosFiltrados.length)}
            total={pedidosFiltrados.length}
            puedeAnterior={paginaSegura > 1}
            puedeSiguiente={paginaSegura < totalPaginas}
            onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
            onSiguiente={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          />
        </>
      )}
    </main>
  )
}
