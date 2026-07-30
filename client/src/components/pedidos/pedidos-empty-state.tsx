// Estado vacío — dos variantes reales:
// - "sinDatos": no existe NINGÚN pedido en la base → invita a crear el primero.
// - "sinResultados": sí hay pedidos, pero el filtro/búsqueda actual no
//   devuelve nada → invita a limpiar filtros, NO a "crear tu primer pedido".
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Plus, FilterX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PedidosEmptyState({
  variante,
  onLimpiarFiltros,
}: {
  variante: 'sinDatos' | 'sinResultados'
  onLimpiarFiltros?: () => void
}) {
  const { t } = useTranslation()
  const sinDatos = variante === 'sinDatos'

  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
        <ClipboardList className="h-11 w-11 text-primary" />
        <span className="absolute -right-1 top-1 h-2.5 w-2.5 rounded-full bg-blue-200" />
        <span className="absolute -left-2 bottom-3 h-2 w-2 rounded-full bg-blue-200" />
        <span className="absolute bottom-0 right-4 h-1.5 w-1.5 rounded-full bg-blue-300" />
      </div>

      <h3 className="mt-5 text-[23px] font-bold text-foreground">
        {sinDatos ? t('pedidos.noHayPedidos') : t('pedidos.noEncontramos')}
      </h3>
      <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
        {sinDatos ? t('pedidos.creaPrimero') : t('pedidos.pruebaFiltros')}
      </p>
      {sinDatos && <p className="mt-1 max-w-sm text-[15px] text-muted-foreground">{t('pedidos.creaPrimeroExtra')}</p>}

      {sinDatos ? (
        <Link href="/">
          <Button className="mt-6 h-12 gap-2 rounded-lg shadow-sm shadow-primary/20">
            <Plus className="h-4 w-4" />
            {t('pedidoForm.nuevoPedido')}
          </Button>
        </Link>
      ) : (
        <Button className="mt-6 h-12 gap-2 rounded-lg" variant="secondary" onClick={onLimpiarFiltros}>
          <FilterX className="h-4 w-4" />
          {t('pedidos.limpiarFiltros')}
        </Button>
      )}
    </div>
  )
}
