'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconAlert, IconCheck, IconClose, IconTrash } from '../../components/icons'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'capturista', label: 'Capturista' },
  { value: 'surtidor', label: 'Surtidor' },
]

const labelRol = (v) => ROLES.find((r) => r.value === v)?.label || v

const formVacio = () => ({
  nombre: '',
  rol: 'surtidor',
  email: '',
  pin: '',
  nfcUid: '',
})

export default function UsuariosCliente({ usuarios }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(formVacio())
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  const editarUsuario = (u) => {
    setEditandoId(u.id)
    setForm({
      nombre: u.nombre || '',
      rol: u.rol,
      email: u.email || '',
      pin: '',
      nfcUid: u.nfcUid || '',
    })
    setError('')
    setExito('')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setForm(formVacio())
    setError('')
    setExito('')
  }

  const escanearUid = async () => {
    setError('')
    setEscaneando(true)
    try {
      const reader = new window.NDEFReader()
      await reader.scan()
      reader.addEventListener(
        'reading',
        (event) => {
          if (event.serialNumber) {
            setForm((prev) => ({ ...prev, nfcUid: event.serialNumber }))
          } else {
            setError('No se pudo leer el UID del tag')
          }
          setEscaneando(false)
        },
        { once: true }
      )
      reader.addEventListener('readingerror', () => {
        setError('Error al leer el tag NFC')
        setEscaneando(false)
      })
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el escaneo')
      setEscaneando(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setExito('')

    const nombre = form.nombre.trim()
    const email = form.email.trim()
    const pin = form.pin.trim()
    const nfcUid = form.nfcUid.trim()

    if (!nombre) return setError('Falta el nombre')
    if (!email && !nfcUid) {
      return setError('Necesita al menos email+PIN o tag NFC')
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError('Email inválido')
    }
    if (email && !pin && !editandoId) {
      return setError('Si pones email también necesita PIN')
    }
    if (pin && !/^\d{6,}$/.test(pin)) {
      return setError('PIN debe ser mínimo 6 dígitos numéricos')
    }

    setEnviando(true)
    try {
      const url = editandoId ? `/api/usuarios/${editandoId}` : '/api/usuarios'
      const method = editandoId ? 'PATCH' : 'POST'

      const body = editandoId
        ? {
            nombre,
            rol: form.rol,
            email,
            nfcUid,
            ...(pin ? { pin } : {}),
          }
        : { nombre, rol: form.rol, email, pin, nfcUid }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo guardar')
      }

      setExito(editandoId ? 'Usuario actualizado' : 'Usuario agregado')
      setForm(formVacio())
      setEditandoId(null)
      startTransition(() => router.refresh())
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = async (u) => {
    const nombre = u.nombre || u.email || 'este usuario'
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return
    setEliminandoId(u.id)
    setError('')
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar')
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Usuarios</h1>
        <p className="subtitle">
          Agrega o edita usuarios. Pueden entrar con email + PIN, NFC, o ambos.
        </p>
      </div>

      <div className="usuarios-grid">
      <div className="card">
        <h2>{editandoId ? 'Editar usuario' : 'Agregar usuario'}</h2>

        <form onSubmit={submit}>
          <div className="section">
            <label className="label" htmlFor="u-nombre">Nombre</label>
            <input
              id="u-nombre"
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Juan Pérez"
              required
            />
          </div>

          <div className="section">
            <div className="label">Rol</div>
            <div className="condiciones">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`condicion-chip ${form.rol === r.value ? 'activa' : ''}`}
                >
                  <input
                    type="radio"
                    name="rol"
                    value={r.value}
                    checked={form.rol === r.value}
                    onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <div className="section">
            <label className="label" htmlFor="u-email">
              Email
              <span className="label-help">opcional, para login con email + PIN</span>
            </label>
            <input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@correo.com"
            />
          </div>

          <div className="section">
            <label className="label" htmlFor="u-pin">
              PIN
              <span className="label-help">
                {editandoId ? 'deja vacío para no cambiar el PIN' : 'mínimo 6 dígitos'}
              </span>
            </label>
            <input
              id="u-pin"
              type="text"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              placeholder={editandoId ? 'Solo si quieres cambiarlo' : '123456'}
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
                onChange={(e) => setForm({ ...form, nfcUid: e.target.value })}
                placeholder="04:35:28:92:6B:1C:90"
              />
              {nfcSoportado && (
                <button
                  type="button"
                  onClick={escanearUid}
                  disabled={escaneando || enviando}
                  className="btn btn-secondary"
                >
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

          {error && (
            <div className="alerta alerta-error">
              <IconAlert /><span>{error}</span>
            </div>
          )}

          {exito && (
            <div className="alerta alerta-exito">
              <IconCheck /><span>{exito}</span>
            </div>
          )}

          <div className="form-acciones">
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="btn btn-secondary btn-large"
              >
                Cancelar
              </button>
            )}
            <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
              {enviando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar usuario'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
          Usuarios registrados ({usuarios.length})
        </h2>
        {usuarios.length === 0 ? (
          <div className="empty">
            <p>No hay usuarios todavía.</p>
          </div>
        ) : (
          <table className="tabla-pedidos">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Email</th>
                <th>Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={editandoId === u.id ? 'editando' : ''}>
                  <td data-label="Nombre">
                    <strong>{u.nombre || '—'}</strong>
                  </td>
                  <td data-label="Rol">
                    <span className={`nav-rol-badge rol-${u.rol}`}>{labelRol(u.rol)}</span>
                  </td>
                  <td data-label="Email">
                    {u.email || <span className="tag-empty">—</span>}
                  </td>
                  <td data-label="Login">
                    <div className="tags-celda">
                      {u.tienePin && <span className="tag tag-grb">PIN</span>}
                      {u.tieneNfc && <span className="tag tag-gra">NFC</span>}
                      {!u.tienePin && !u.tieneNfc && <span className="tag-empty">—</span>}
                    </div>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        onClick={() => editarUsuario(u)}
                        className="btn btn-secondary btn-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(u)}
                        disabled={eliminandoId === u.id}
                        className="btn btn-danger btn-sm"
                      >
                        <IconTrash />
                        {eliminandoId === u.id ? '…' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </main>
  )
}
