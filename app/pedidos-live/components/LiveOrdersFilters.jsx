'use client'

import { useTranslation } from 'react-i18next'
import { IconSearch } from '../../components/icons'

const CAMPOS_FILTRO = ['estado', 'marketplace', 'cuenta', 'ubicacion']

// filtros: { estado, marketplace, cuenta, fecha, ubicacion } (strings, '' = sin filtro)
// opciones: { estados, marketplaces, cuentas, ubicaciones } | null (mientras carga)
export default function LiveOrdersFilters({ busqueda, onBusquedaChange, filtros, onFiltroChange, onLimpiar, opciones }) {
  const { t } = useTranslation()

  const chipsActivos = [
    ...CAMPOS_FILTRO.filter((campo) => filtros[campo]).map((campo) => ({ campo, valor: filtros[campo] })),
    ...(filtros.fecha ? [{ campo: 'fecha', valor: filtros.fecha }] : []),
  ]
  const hayFiltrosActivos = chipsActivos.length > 0 || busqueda.trim().length > 0

  return (
    <div className="card live-orders-filtros">
      <div className="historial-filtros-fila live-orders-toolbar">
        <div className="search-box historial-buscador">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder={t('pedidosLive.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
          />
        </div>

        <div className="filtro-campo">
          <label>{t('pedidosLive.filtroEstado')}</label>
          <select value={filtros.estado} onChange={(e) => onFiltroChange('estado', e.target.value)}>
            <option value="">{t('historial.todos')}</option>
            {(opciones?.estados || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="filtro-campo">
          <label>{t('pedidosLive.filtroMarketplace')}</label>
          <select value={filtros.marketplace} onChange={(e) => onFiltroChange('marketplace', e.target.value)}>
            <option value="">{t('historial.todos')}</option>
            {(opciones?.marketplaces || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="filtro-campo">
          <label>{t('pedidosLive.filtroCuenta')}</label>
          <select value={filtros.cuenta} onChange={(e) => onFiltroChange('cuenta', e.target.value)}>
            <option value="">{t('historial.todos')}</option>
            {(opciones?.cuentas || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="filtro-campo">
          <label>{t('pedidosLive.filtroFecha')}</label>
          <input type="date" value={filtros.fecha} onChange={(e) => onFiltroChange('fecha', e.target.value)} />
        </div>

        <div className="filtro-campo">
          <label>{t('pedidosLive.filtroUbicacion')}</label>
          <select value={filtros.ubicacion} onChange={(e) => onFiltroChange('ubicacion', e.target.value)}>
            <option value="">{t('historial.todos')}</option>
            {(opciones?.ubicaciones || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onLimpiar} disabled={!hayFiltrosActivos}>
          {t('historial.limpiar')}
        </button>
      </div>

      {chipsActivos.length > 0 && (
        <div className="filtros-chips">
          {chipsActivos.map(({ campo, valor }) => (
            <button
              key={campo}
              type="button"
              className="filtro-chip"
              onClick={() => onFiltroChange(campo, '')}
              aria-label={t('pedidosLive.quitarFiltro', { valor })}
            >
              {valor}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
