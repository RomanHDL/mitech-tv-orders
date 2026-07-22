'use client'

import { useTranslation } from 'react-i18next'
import ModulePermissionGrid from './modulo-permission-grid'

const ROLES = ['admin', 'capturista', 'surtidor']

// Campos del formulario, sin <form> ni barra de acciones (esas viven en
// UsuarioDrawer) — el mismo componente sirve para crear y editar, controlado
// por el objeto `form` que le pasa el padre.
export default function UsuarioForm({
  form,
  onChange,
  editando,
  nfcSoportado,
  escaneando,
  onEscanear,
  errorModulos,
  nombreInputRef,
}) {
  const { t } = useTranslation()
  const set = (campo, valor) => onChange({ ...form, [campo]: valor })

  return (
    <>
      <div className="form-seccion">
        <h3 className="form-seccion-titulo">{t('usuarios.datosGenerales')}</h3>

        <div className="section">
          <label className="label" htmlFor="u-nombre">{t('usuarios.nombreLabel')}</label>
          <input
            id="u-nombre"
            ref={nombreInputRef}
            type="text"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder={t('usuarios.nombrePlaceholder')}
            required
          />
        </div>

        <div className="section">
          <div className="label">{t('usuarios.rolLabel')}</div>
          <div className="condiciones">
            {ROLES.map((r) => (
              <label key={r} className={`condicion-chip ${form.rol === r ? 'activa' : ''}`}>
                <input
                  type="radio"
                  name="rol"
                  value={r}
                  checked={form.rol === r}
                  onChange={(e) => set('rol', e.target.value)}
                />
                {t(`usuarios.rol${r.charAt(0).toUpperCase()}${r.slice(1)}`)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-seccion">
        <h3 className="form-seccion-titulo">{t('usuarios.metodoAcceso')}</h3>

        <div className="section">
          <label className="label" htmlFor="u-email">
            {t('usuarios.emailLabel')}
            <span className="label-help">{t('usuarios.emailHelp')}</span>
          </label>
          <input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder={t('usuarios.emailPlaceholder')}
          />
        </div>

        <div className="section">
          <label className="label" htmlFor="u-pin">
            {t('usuarios.pinLabel')}
            <span className="label-help">
              {editando ? t('usuarios.pinHelpEditando') : t('usuarios.pinHelpNuevo')}
            </span>
          </label>
          <input
            id="u-pin"
            type="text"
            value={form.pin}
            onChange={(e) => set('pin', e.target.value)}
            placeholder={editando ? t('usuarios.pinPlaceholderEditando') : '123456'}
            inputMode="numeric"
            pattern="\d{6,}"
            autoComplete="new-password"
          />
        </div>

        <div className="section">
          <label className="label" htmlFor="u-nfc">
            {t('usuarios.nfcUidLabel')}
            <span className="label-help">{t('usuarios.nfcUidHelp')}</span>
          </label>
          <div className="usuario-nfc-input">
            <input
              id="u-nfc"
              type="text"
              value={form.nfcUid}
              onChange={(e) => set('nfcUid', e.target.value)}
              placeholder="04:35:28:92:6B:1C:90"
            />
            {nfcSoportado && (
              <button type="button" onClick={onEscanear} disabled={escaneando} className="btn btn-secondary">
                {escaneando ? t('usuarios.acercaTag') : t('usuarios.escanearTag')}
              </button>
            )}
          </div>
          {!nfcSoportado && (
            <p className="login-hint" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
              {t('usuarios.nfcHintManual')}
            </p>
          )}
        </div>
      </div>

      <ModulePermissionGrid
        rol={form.rol}
        allowedModules={form.allowedModules}
        onChange={(allowedModules) => onChange({ ...form, allowedModules })}
        error={errorModulos}
      />
    </>
  )
}
