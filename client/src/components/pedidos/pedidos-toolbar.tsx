// Barra de filtros y acciones — buscador (debounced en el padre), estado,
// rango de fechas (por fecha de creación), orden y el botón real de "Nuevo
// pedido" (misma ruta "/" de siempre).
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { Search, Plus, FileSpreadsheet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export type EstadoFiltro =
  | 'todos'
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'TERMINADO'
  | 'CARGANDO'
  | 'LISTO_SALIDA'
  | 'DESPACHADO'
  | 'CANCELADO'
  | 'VENCIDOS'
export type OrdenarPor = 'recientes' | 'antiguos' | 'fechaLimite' | 'nombre' | 'cantidad'

const selectClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function PedidosToolbar({
  busqueda,
  onBusquedaChange,
  estado,
  onEstadoChange,
  fechaDesde,
  onFechaDesdeChange,
  fechaHasta,
  onFechaHastaChange,
  ordenarPor,
  onOrdenarPorChange,
  onExportarExcel,
  exportarDeshabilitado,
}: {
  busqueda: string
  onBusquedaChange: (v: string) => void
  estado: EstadoFiltro
  onEstadoChange: (v: EstadoFiltro) => void
  fechaDesde: string
  onFechaDesdeChange: (v: string) => void
  fechaHasta: string
  onFechaHastaChange: (v: string) => void
  ordenarPor: OrdenarPor
  onOrdenarPorChange: (v: OrdenarPor) => void
  onExportarExcel: () => void
  exportarDeshabilitado: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full space-y-1.5 sm:w-auto sm:min-w-[300px] sm:flex-1">
          <Label htmlFor="pedidos-buscar" className="sr-only">
            {t('pedidos.buscarPlaceholder')}
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pedidos-buscar"
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              placeholder={t('pedidos.buscarPlaceholder')}
              className="h-11 rounded-lg pl-9"
            />
          </div>
        </div>

        <div className="w-full space-y-1.5 sm:w-auto">
          <Label htmlFor="pedidos-estado">{t('pedidos.filtroEstado')}</Label>
          <select
            id="pedidos-estado"
            className={selectClass}
            value={estado}
            onChange={(e) => onEstadoChange(e.target.value as EstadoFiltro)}
          >
            <option value="todos">{t('pedidos.todosEstados')}</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="TERMINADO">Surtido terminado</option>
            <option value="CARGANDO">Cargando</option>
            <option value="LISTO_SALIDA">Listo para salida</option>
            <option value="DESPACHADO">Despachado</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="VENCIDOS">Vencidos</option>
          </select>
        </div>

        <div className="w-full space-y-1.5 sm:w-auto">
          <Label htmlFor="pedidos-desde">{t('pedidos.fechaDesde')}</Label>
          <Input
            id="pedidos-desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => onFechaDesdeChange(e.target.value)}
            className="h-11 rounded-lg"
          />
        </div>

        <div className="w-full space-y-1.5 sm:w-auto">
          <Label htmlFor="pedidos-hasta">{t('pedidos.fechaHasta')}</Label>
          <Input
            id="pedidos-hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => onFechaHastaChange(e.target.value)}
            className="h-11 rounded-lg"
          />
        </div>

        <div className="w-full space-y-1.5 sm:w-auto">
          <Label htmlFor="pedidos-orden">{t('pedidos.ordenarPor')}</Label>
          <select
            id="pedidos-orden"
            className={selectClass}
            value={ordenarPor}
            onChange={(e) => onOrdenarPorChange(e.target.value as OrdenarPor)}
          >
            <option value="recientes">{t('pedidos.masRecientes')}</option>
            <option value="antiguos">{t('pedidos.masAntiguos')}</option>
            <option value="fechaLimite">{t('pedidos.porFechaLimite')}</option>
            <option value="nombre">{t('pedidos.porNombre')}</option>
            <option value="cantidad">{t('pedidos.porCantidad')}</option>
          </select>
        </div>

        <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
          <Button
            variant="secondary"
            className="h-11 flex-1 gap-2 rounded-lg sm:flex-none"
            onClick={onExportarExcel}
            disabled={exportarDeshabilitado}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Link href="/" className="flex-1 sm:flex-none">
            <Button className="h-11 w-full gap-2 rounded-lg shadow-sm shadow-primary/20 sm:w-auto">
              <Plus className="h-4 w-4" />
              {t('pedidoForm.nuevoPedido')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
