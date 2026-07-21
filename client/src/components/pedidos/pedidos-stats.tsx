// Cuatro tarjetas de métricas — SIEMPRE sobre el total global de pedidos
// (no los filtrados), decisión explícita del Módulo 2. Usa las mismas
// funciones derivadas de pedido-stats.ts que ya usaba la tabla, sin tocarlas.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Clock, RefreshCw, CheckCircle2 } from 'lucide-react'
import { badgeProgreso, progresoPct } from '@/lib/pedido-stats'
import type { PedidoConTvs } from '@shared/schema'

export default function PedidosStats({ pedidos }: { pedidos: PedidoConTvs[] }) {
  const { t } = useTranslation()

  const { total, pendientes, enProceso, completados } = useMemo(() => {
    let pendientes = 0
    let enProceso = 0
    let completados = 0
    for (const p of pedidos) {
      const clase = badgeProgreso(progresoPct(p)).clase
      if (clase === 'completo') completados++
      else if (clase === 'parcial') enProceso++
      else pendientes++
    }
    return { total: pedidos.length, pendientes, enProceso, completados }
  }, [pedidos])

  const tarjetas = [
    {
      valor: total,
      titulo: t('pedidos.metricaTotal'),
      desc: t('pedidos.metricaTotalDesc'),
      icono: FileText,
      color: 'bg-blue-50 text-primary',
    },
    {
      valor: pendientes,
      titulo: t('pedidos.metricaPendientes'),
      desc: t('pedidos.metricaPendientesDesc'),
      icono: Clock,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      valor: enProceso,
      titulo: t('pedidos.enProceso'),
      desc: t('pedidos.metricaEnProcesoDesc'),
      icono: RefreshCw,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      valor: completados,
      titulo: t('pedidos.metricaCompletados'),
      desc: t('pedidos.metricaCompletadosDesc'),
      icono: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600',
    },
  ]

  return (
    <div className="mt-5 mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((c) => (
        <div key={c.titulo} className="flex min-h-[122px] items-center gap-4 rounded-xl border bg-card p-[22px] shadow-sm">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${c.color}`}>
            <c.icono className="h-6 w-6" />
          </span>
          <div>
            <div className="text-[26px] font-bold leading-none text-foreground">{c.valor}</div>
            <div className="mt-1.5 text-[15px] font-semibold text-foreground">{c.titulo}</div>
            <div className="text-sm text-muted-foreground">{c.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
