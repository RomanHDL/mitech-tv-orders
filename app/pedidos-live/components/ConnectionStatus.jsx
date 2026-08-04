'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function segundosDesde(timestamp) {
  if (!timestamp) return null
  return Math.max(0, Math.round((Date.now() - timestamp) / 1000))
}

// estado: 'vivo' | 'actualizando' | 'sinConexion'
export default function ConnectionStatus({ estado, ultimaActualizacion }) {
  const { t } = useTranslation()
  // Tick propio cada segundo solo para refrescar "hace X segundos" — no
  // depende de que el padre vuelva a renderizar por otra razón.
  const [, forzarTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forzarTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const segundos = segundosDesde(ultimaActualizacion)

  return (
    <div className="conexion-estado">
      <span className={`conexion-punto conexion-punto-${estado}`} aria-hidden="true" />
      <div className="conexion-texto">
        <span className={`conexion-label conexion-label-${estado}`}>
          {t(`pedidosLive.conexion.${estado}`)}
        </span>
        {segundos !== null && (
          <span className="conexion-subtexto">
            {segundos < 2
              ? t('pedidosLive.conexion.actualizadoAhora')
              : t('pedidosLive.conexion.actualizadoHace', { segundos })}
          </span>
        )}
      </div>
    </div>
  )
}
