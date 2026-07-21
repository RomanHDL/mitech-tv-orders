'use client'

import { useTranslation } from 'react-i18next'
import { MODULOS, MODULO_IDS, DEFAULT_MODULOS_POR_ROL } from '@/lib/modulos'

// Cuadrícula de permisos por módulo — usada tanto al crear como al editar
// (una sola fuente de lógica, sin duplicar entre los dos modos). Los ids que
// se guardan son siempre los internos de lib/modulos.js, nunca el texto
// traducido visible.
export default function ModulePermissionGrid({ rol, allowedModules, onChange, error }) {
  const { t } = useTranslation()

  const toggleModulo = (id) => {
    onChange(
      allowedModules.includes(id)
        ? allowedModules.filter((m) => m !== id)
        : [...allowedModules, id]
    )
  }

  const todosSeleccionados = allowedModules.length === MODULO_IDS.length

  const toggleSeleccionarTodos = () => {
    onChange(todosSeleccionados ? [] : [...MODULO_IDS])
  }

  const aplicarSegunRol = () => {
    onChange([...(DEFAULT_MODULOS_POR_ROL[rol] || [])])
  }

  return (
    <div className="form-seccion" aria-describedby={error ? 'modulos-permitidos-error' : undefined}>
      <div className="form-seccion-header">
        <h3 className="form-seccion-titulo">{t('usuarios.modulosPermitidos')}</h3>
        <div className="modulos-acciones">
          <button type="button" onClick={toggleSeleccionarTodos} className="btn btn-secondary btn-sm">
            {todosSeleccionados ? t('usuarios.deseleccionarTodos') : t('usuarios.seleccionarTodos')}
          </button>
          <button type="button" onClick={aplicarSegunRol} className="btn btn-secondary btn-sm">
            {t('usuarios.segunRol')}
          </button>
        </div>
      </div>

      <div className="modulos-grid">
        {MODULOS.map((m) => {
          const activo = allowedModules.includes(m.id)
          return (
            <label key={m.id} className={`modulo-card ${activo ? 'activo' : ''}`}>
              <input type="checkbox" checked={activo} onChange={() => toggleModulo(m.id)} />
              <span>{t(m.labelKey)}</span>
            </label>
          )
        })}
      </div>

      <p className="modulos-contador">
        {t('usuarios.modulosSeleccionadosCount', { n: allowedModules.length, total: MODULO_IDS.length })}
      </p>

      {error && (
        <div className="alerta alerta-error" id="modulos-permitidos-error">
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
