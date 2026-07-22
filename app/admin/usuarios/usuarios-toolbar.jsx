'use client'

import { useTranslation } from 'react-i18next'
import { IconPlus, IconSearch } from '../../components/icons'

const ROLES = ['admin', 'capturista', 'surtidor']

export default function UsuariosToolbar({ busqueda, onBusquedaChange, rolFiltro, onRolFiltroChange, onAgregar }) {
  const { t } = useTranslation()

  return (
    <div className="card usuarios-toolbar">
      <div className="search-box usuarios-buscador">
        <IconSearch className="icon-search" />
        <input
          type="text"
          placeholder={t('usuarios.buscarPlaceholder')}
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
        />
      </div>

      <div className="filtro-campo usuarios-filtro-rol">
        <select value={rolFiltro} onChange={(e) => onRolFiltroChange(e.target.value)} aria-label={t('usuarios.filtrarPorRol')}>
          <option value="todos">{t('usuarios.todosLosRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{t(`usuarios.rol${r.charAt(0).toUpperCase()}${r.slice(1)}`)}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onAgregar}
        className="btn btn-primary usuarios-btn-agregar"
      >
        <IconPlus /> {t('usuarios.agregarUsuario')}
      </button>
    </div>
  )
}
