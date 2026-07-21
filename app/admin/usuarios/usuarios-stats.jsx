'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBox, IconClipboard, IconShield, IconUser } from '../../components/icons'

// Las 4 tarjetas se calculan de la lista de usuarios YA cargada por la
// página (misma prop que usa la tabla) — nunca se pide de nuevo al backend.
export default function UsuariosStats({ usuarios }) {
  const { t } = useTranslation()

  const conteos = useMemo(() => {
    const c = { total: usuarios.length, admin: 0, surtidor: 0, capturista: 0 }
    for (const u of usuarios) {
      if (u.rol === 'admin') c.admin++
      else if (u.rol === 'surtidor') c.surtidor++
      else if (u.rol === 'capturista') c.capturista++
    }
    return c
  }, [usuarios])

  return (
    <div className="metricas-grid usuarios-stats">
      <div className="metrica-card metrica-usuarios-total">
        <span className="metrica-icono"><IconUser /></span>
        <div>
          <div className="metrica-valor">{conteos.total}</div>
          <div className="metrica-titulo">{t('usuarios.statsUsuariosTitulo')}</div>
          <div className="metrica-desc">{t('usuarios.statsUsuariosDesc')}</div>
        </div>
      </div>
      <div className="metrica-card metrica-usuarios-admin">
        <span className="metrica-icono"><IconShield /></span>
        <div>
          <div className="metrica-valor">{conteos.admin}</div>
          <div className="metrica-titulo">{t('usuarios.statsAdminsTitulo')}</div>
          <div className="metrica-desc">{t('usuarios.statsAdminsDesc')}</div>
        </div>
      </div>
      <div className="metrica-card metrica-usuarios-surtidor">
        <span className="metrica-icono"><IconBox /></span>
        <div>
          <div className="metrica-valor">{conteos.surtidor}</div>
          <div className="metrica-titulo">{t('usuarios.statsSurtidoresTitulo')}</div>
          <div className="metrica-desc">{t('usuarios.statsSurtidoresDesc')}</div>
        </div>
      </div>
      <div className="metrica-card metrica-usuarios-capturista">
        <span className="metrica-icono"><IconClipboard /></span>
        <div>
          <div className="metrica-valor">{conteos.capturista}</div>
          <div className="metrica-titulo">{t('usuarios.statsCapturistasTitulo')}</div>
          <div className="metrica-desc">{t('usuarios.statsCapturistasDesc')}</div>
        </div>
      </div>
    </div>
  )
}
