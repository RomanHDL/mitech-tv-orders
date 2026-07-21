'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconCheck } from '../../components/icons'
import { DEFAULT_MODULOS_POR_ROL, sanearModulos } from '@/lib/modulos'
import UsuariosStats from './usuarios-stats'
import UsuariosToolbar from './usuarios-toolbar'
import UsuariosTabla from './usuarios-tabla'
import UsuarioDrawer from './usuario-drawer'
import UsuarioForm from './usuario-form'
import ConfirmarDialog from './confirmar-dialog'

const POR_PAGINA = 8

const formVacio = () => ({
  nombre: '',
  rol: 'surtidor',
  email: '',
  pin: '',
  nfcUid: '',
  allowedModules: [...(DEFAULT_MODULOS_POR_ROL.surtidor || [])],
})

function formParaUsuario(u) {
  const mods = sanearModulos(u.allowedModules)
  return {
    nombre: u.nombre || '',
    rol: u.rol,
    email: u.email || '',
    pin: '',
    nfcUid: u.nfcUid || '',
    allowedModules: mods.length > 0 ? mods : [...(DEFAULT_MODULOS_POR_ROL[u.rol] || [])],
  }
}

export default function UsuariosCliente({ usuarios }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Búsqueda / filtro / paginación
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [pagina, setPagina] = useState(1)

  // Panel lateral (crear/editar)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState(null) // null = modo creación
  const [form, setForm] = useState(formVacio())
  const [error, setError] = useState('')
  const [errorModulos, setErrorModulos] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [nfcSoportado, setNfcSoportado] = useState(false)
  const formInicialRef = useRef(formVacio())
  const nombreInputRef = useRef(null)

  // Confirmación de "cambios sin guardar" (cerrar / cambiar de usuario)
  const [descartarPendiente, setDescartarPendiente] = useState(false)
  const accionPendienteRef = useRef(null) // { tipo: 'cerrar' } | { tipo: 'abrir', usuario: null|object }

  // Eliminación
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')

  // Notificación de éxito a nivel de página (el panel ya se cerró para cuando se muestra)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  // Volver a la primera página cuando cambian los filtros.
  useEffect(() => {
    setPagina(1)
  }, [busqueda, rolFiltro])

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const usuariosFiltrados = usuarios.filter((u) => {
    const coincideBusqueda =
      !busquedaNormalizada ||
      (u.nombre || '').toLowerCase().includes(busquedaNormalizada) ||
      (u.email || '').toLowerCase().includes(busquedaNormalizada)
    const coincideRol = rolFiltro === 'todos' || u.rol === rolFiltro
    return coincideBusqueda && coincideRol
  })
  const hayFiltrosActivos = busquedaNormalizada !== '' || rolFiltro !== 'todos'

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const usuariosPagina = usuariosFiltrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  )

  function limpiarFiltros() {
    setBusqueda('')
    setRolFiltro('todos')
  }

  function estaSucio() {
    return JSON.stringify(form) !== JSON.stringify(formInicialRef.current)
  }

  function abrirDrawer(usuarioObjetivo) {
    const nuevaForm = usuarioObjetivo ? formParaUsuario(usuarioObjetivo) : formVacio()
    setEditandoUsuario(usuarioObjetivo || null)
    setForm(nuevaForm)
    formInicialRef.current = nuevaForm
    setError('')
    setErrorModulos('')
    setDrawerAbierto(true)
  }

  // Punto de entrada único para abrir el panel (crear o editar). Si ya está
  // abierto con cambios sin guardar, pide confirmación antes de reemplazar
  // el formulario — nunca sobrescribe en silencio.
  function solicitarAbrir(usuarioObjetivo) {
    if (drawerAbierto && estaSucio()) {
      accionPendienteRef.current = { tipo: 'abrir', usuario: usuarioObjetivo || null }
      setDescartarPendiente(true)
      return
    }
    abrirDrawer(usuarioObjetivo)
  }

  function cerrarDrawer() {
    setDrawerAbierto(false)
  }

  // Punto de entrada único para cualquier intento de cierre (X, Cancelar,
  // Escape, clic fuera) — con el mismo resguardo de cambios sin guardar.
  function solicitarCierre() {
    if (estaSucio()) {
      accionPendienteRef.current = { tipo: 'cerrar' }
      setDescartarPendiente(true)
      return
    }
    cerrarDrawer()
  }

  function confirmarDescartar() {
    const accion = accionPendienteRef.current
    setDescartarPendiente(false)
    accionPendienteRef.current = null
    if (!accion) return
    if (accion.tipo === 'cerrar') cerrarDrawer()
    else abrirDrawer(accion.usuario)
  }

  function cancelarDescartar() {
    setDescartarPendiente(false)
    accionPendienteRef.current = null
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

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setErrorModulos('')

    const nombre = form.nombre.trim()
    const email = form.email.trim()
    const pin = form.pin.trim()
    const nfcUid = form.nfcUid.trim()
    const idEditando = editandoUsuario?.id || null

    if (!nombre) return setError('Falta el nombre')
    if (!email && !nfcUid) return setError('Necesita al menos email+PIN o tag NFC')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email inválido')
    if (email && !pin && !idEditando) return setError('Si pones email también necesita PIN')
    if (pin && !/^\d{6,}$/.test(pin)) return setError('PIN debe ser mínimo 6 dígitos numéricos')
    const allowedModules = sanearModulos(form.allowedModules)
    if (allowedModules.length === 0) return setErrorModulos(t('usuarios.debeSeleccionarModulo'))

    setEnviando(true)
    try {
      const url = idEditando ? `/api/usuarios/${idEditando}` : '/api/usuarios'
      const method = idEditando ? 'PATCH' : 'POST'
      const body = idEditando
        ? { nombre, rol: form.rol, email, nfcUid, allowedModules, ...(pin ? { pin } : {}) }
        : { nombre, rol: form.rol, email, pin, nfcUid, allowedModules }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo guardar')
      }

      setToast({ tipo: 'exito', texto: idEditando ? t('usuarios.usuarioActualizado') : t('usuarios.usuarioCreado') })
      cerrarDrawer()
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarEliminar() {
    const u = usuarioAEliminar
    if (!u) return
    setEliminandoId(u.id)
    setErrorEliminar('')
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar')
      }
      setUsuarioAEliminar(null)
      setToast({ tipo: 'exito', texto: 'Usuario eliminado correctamente' })
      startTransition(() => router.refresh())
    } catch (err) {
      setErrorEliminar(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <main className="page-wide usuarios-page">
      <div className="page-header">
        <h1>Usuarios</h1>
        <p className="subtitle">{t('usuarios.subtitulo')}</p>
      </div>

      {toast && (
        <div className={`alerta alerta-${toast.tipo} usuarios-toast`}>
          <IconCheck /><span>{toast.texto}</span>
        </div>
      )}

      <UsuariosStats usuarios={usuarios} />

      <UsuariosToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        rolFiltro={rolFiltro}
        onRolFiltroChange={setRolFiltro}
        onAgregar={() => solicitarAbrir(null)}
      />

      <UsuariosTabla
        usuariosPagina={usuariosPagina}
        totalFiltrado={usuariosFiltrados.length}
        totalUsuarios={usuarios.length}
        pagina={paginaSegura}
        totalPaginas={totalPaginas}
        porPagina={POR_PAGINA}
        onPaginaChange={setPagina}
        onEditar={(u) => solicitarAbrir(u)}
        onEliminarClick={setUsuarioAEliminar}
        eliminandoId={eliminandoId}
        onAgregarClick={() => solicitarAbrir(null)}
        onLimpiarFiltros={limpiarFiltros}
        hayFiltrosActivos={hayFiltrosActivos}
      />

      <UsuarioDrawer
        abierto={drawerAbierto}
        titulo={editandoUsuario ? t('usuarios.editarUsuario') : t('usuarios.agregarUsuario')}
        subtitulo={editandoUsuario ? (editandoUsuario.nombre || editandoUsuario.email) : null}
        editando={Boolean(editandoUsuario)}
        enviando={enviando}
        onSubmit={manejarSubmit}
        onSolicitarCierre={solicitarCierre}
        focoInicialRef={nombreInputRef}
        bloqueado={descartarPendiente}
      >
        <UsuarioForm
          form={form}
          onChange={setForm}
          editando={Boolean(editandoUsuario)}
          nfcSoportado={nfcSoportado}
          escaneando={escaneando}
          onEscanear={escanearUid}
          errorModulos={errorModulos}
          nombreInputRef={nombreInputRef}
        />

        {error && (
          <div className="alerta alerta-error">
            <IconAlert /><span>{error}</span>
          </div>
        )}
      </UsuarioDrawer>

      {descartarPendiente && (
        <ConfirmarDialog
          titulo={t('usuarios.descartarCambiosTitulo')}
          texto={t('usuarios.descartarCambiosTexto')}
          labelCancelar={t('usuarios.seguirEditando')}
          labelConfirmar={t('usuarios.descartarCambios')}
          peligroso
          onConfirmar={confirmarDescartar}
          onCancelar={cancelarDescartar}
        />
      )}

      {usuarioAEliminar && (
        <ConfirmarDialog
          titulo={t('usuarios.confirmarEliminarTitulo', { nombre: usuarioAEliminar.nombre || usuarioAEliminar.email || '' })}
          texto={t('usuarios.confirmarEliminarTexto')}
          labelCancelar={t('common.cancelar')}
          labelConfirmar={t('usuarios.eliminarUsuario')}
          peligroso
          cargando={eliminandoId === usuarioAEliminar.id}
          error={errorEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => { setUsuarioAEliminar(null); setErrorEliminar('') }}
        />
      )}
    </main>
  )
}
