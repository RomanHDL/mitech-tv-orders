'use client'

import ModulePermissionGrid from './modulo-permission-grid'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'capturista', label: 'Capturista' },
  { value: 'surtidor', label: 'Surtidor' },
]

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
  const set = (campo, valor) => onChange({ ...form, [campo]: valor })

  return (
    <>
      <div className="form-seccion">
        <h3 className="form-seccion-titulo">Datos generales</h3>

        <div className="section">
          <label className="label" htmlFor="u-nombre">Nombre</label>
          <input
            id="u-nombre"
            ref={nombreInputRef}
            type="text"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Ej. Juan Pérez"
            required
          />
        </div>

        <div className="section">
          <div className="label">Rol</div>
          <div className="condiciones">
            {ROLES.map((r) => (
              <label key={r.value} className={`condicion-chip ${form.rol === r.value ? 'activa' : ''}`}>
                <input
                  type="radio"
                  name="rol"
                  value={r.value}
                  checked={form.rol === r.value}
                  onChange={(e) => set('rol', e.target.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-seccion">
        <h3 className="form-seccion-titulo">Método de acceso</h3>

        <div className="section">
          <label className="label" htmlFor="u-email">
            Email
            <span className="label-help">opcional, para login con email + PIN</span>
          </label>
          <input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="usuario@correo.com"
          />
        </div>

        <div className="section">
          <label className="label" htmlFor="u-pin">
            PIN
            <span className="label-help">
              {editando ? 'deja vacío para no cambiar el PIN' : 'mínimo 6 dígitos'}
            </span>
          </label>
          <input
            id="u-pin"
            type="text"
            value={form.pin}
            onChange={(e) => set('pin', e.target.value)}
            placeholder={editando ? 'Solo si quieres cambiarlo' : '123456'}
            inputMode="numeric"
            pattern="\d{6,}"
            autoComplete="new-password"
          />
        </div>

        <div className="section">
          <label className="label" htmlFor="u-nfc">
            NFC UID
            <span className="label-help">opcional, para login con tag NFC</span>
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
                {escaneando ? 'Acerca tag…' : 'Escanear tag'}
              </button>
            )}
          </div>
          {!nfcSoportado && (
            <p className="login-hint" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
              Para escanear el UID directamente, abre esta página en un Android con Chrome.
              Mientras tanto puedes copiar el UID a mano.
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
