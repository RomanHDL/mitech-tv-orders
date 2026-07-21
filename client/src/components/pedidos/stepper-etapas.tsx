// Stepper horizontal compacto del ciclo logístico — puerto de
// app/pedidos/stepper-etapas.jsx (Vercel). Etapas completadas en verde, la
// actual en azul, las futuras en gris. CANCELADO se muestra aparte como
// badge rojo en vez de "una etapa más" de la línea normal.
import { Activity, Ban, CheckCircle2, Clock, PackagePlus, Send } from 'lucide-react'
import { ETAPAS } from '@/lib/pedido-stats'
import { ESTADO_ORDEN, type EstadoOperativo } from '@shared/schema'

const ICONOS: Record<string, typeof Clock> = {
  PENDIENTE: Clock,
  EN_PROCESO: Activity,
  TERMINADO: CheckCircle2,
  CARGANDO: PackagePlus,
  LISTO_SALIDA: Send,
  DESPACHADO: Send,
}

export default function StepperEtapas({ estado }: { estado: EstadoOperativo }) {
  if (estado === 'CANCELADO') {
    return (
      <div className="py-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3.5 py-1.5 text-sm font-bold text-red-700">
          <Ban className="h-4 w-4" /> Cancelado
        </span>
      </div>
    )
  }

  const rankActual = ESTADO_ORDEN[estado] ?? 0

  return (
    <div className="flex items-start">
      {ETAPAS.map((etapa, i) => {
        const rank = ESTADO_ORDEN[etapa.clave]
        const Icono = ICONOS[etapa.clave]
        const visual = rank < rankActual ? 'completada' : rank === rankActual ? 'actual' : 'futura'
        return (
          <div className={`flex items-center ${i < ETAPAS.length - 1 ? 'flex-1 min-w-0' : 'flex-none'}`} key={etapa.clave}>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                  visual === 'completada'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : visual === 'actual'
                      ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'border-muted-foreground/30 bg-background text-muted-foreground/60'
                }`}
              >
                <Icono className="h-4 w-4" />
              </span>
              <span
                className={`max-w-[5.5rem] text-center text-[0.62rem] font-bold leading-tight ${
                  visual === 'completada'
                    ? 'text-emerald-700'
                    : visual === 'actual'
                      ? 'text-primary'
                      : 'text-muted-foreground/60'
                }`}
              >
                {etapa.label}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className={`mx-[-4px] mt-[18px] h-0.5 flex-1 ${rank < rankActual ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
