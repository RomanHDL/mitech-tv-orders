'use client'

import { useTranslation } from 'react-i18next'
import { ETAPAS } from '@/lib/estado-pedido'
import { ESTADO_ORDEN, estadoLabel } from '@/lib/catalogos'
import {
  IconActivity,
  IconBan,
  IconCheckCircle,
  IconClock,
  IconForklift,
  IconTruck,
  IconTruckCheck,
} from '../components/icons'

const ICONOS = {
  PENDIENTE: IconClock,
  EN_PROCESO: IconActivity,
  TERMINADO: IconCheckCircle,
  CARGANDO: IconForklift,
  LISTO_SALIDA: IconTruckCheck,
  DESPACHADO: IconTruck,
}

// Stepper horizontal compacto del ciclo logístico. Etapas completadas en
// verde, la actual en azul, las futuras en gris. Si el pedido está
// CANCELADO se muestra un badge rojo aparte en vez de la línea completa
// (cancelar no es "una etapa más" del flujo normal).
export default function StepperEtapas({ estado }) {
  const { t } = useTranslation()

  if (estado === 'CANCELADO') {
    return (
      <div className="stepper-etapas stepper-etapas-cancelado">
        <span className="stepper-cancelado-badge">
          <IconBan /> {estadoLabel(t, 'CANCELADO')}
        </span>
      </div>
    )
  }

  const rankActual = ESTADO_ORDEN[estado] ?? 0

  return (
    <div className="stepper-etapas">
      {ETAPAS.map((etapa, i) => {
        const rank = ESTADO_ORDEN[etapa.clave]
        const Icono = ICONOS[etapa.clave]
        const visual = rank < rankActual ? 'completada' : rank === rankActual ? 'actual' : 'futura'
        return (
          <div className="stepper-etapa-wrap" key={etapa.clave}>
            <div className={`stepper-etapa ${visual}`}>
              <span className="stepper-etapa-icono">
                <Icono />
              </span>
              <span className="stepper-etapa-label">{estadoLabel(t, etapa.clave)}</span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className={`stepper-conector ${rank < rankActual ? 'completado' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
