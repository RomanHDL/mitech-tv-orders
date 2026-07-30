// Paginación local sobre los pedidos ya filtrados/ordenados — no toca la
// API (el server sigue devolviendo hasta 100 pedidos tal cual).
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PedidosPagination({
  desde,
  hasta,
  total,
  puedeAnterior,
  puedeSiguiente,
  onAnterior,
  onSiguiente,
}: {
  desde: number
  hasta: number
  total: number
  puedeAnterior: boolean
  puedeSiguiente: boolean
  onAnterior: () => void
  onSiguiente: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{t('pedidos.mostrando', { desde, hasta, total })}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('pedidos.anterior')}
          disabled={!puedeAnterior}
          onClick={onAnterior}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t('pedidos.siguiente')}
          disabled={!puedeSiguiente}
          onClick={onSiguiente}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
