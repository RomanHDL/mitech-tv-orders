// Puerto de app/admin/usuarios/usuarios-cliente.jsx, adaptado a la auth
// híbrida: admin/capturista solo necesitan email (entran por Nextcloud);
// surtidor necesita PIN y/o NFC (sin email obligatorio). El formulario
// cambia de campos según el rol elegido, en vez de aceptar cualquier
// combinación como el original.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Trash2 } from 'lucide-react'
import { apiRequest, ApiError } from '@/lib/queryClient'
import { ROL_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Rol } from '@shared/schema'

type UsuarioFila = {
  id: string
  email: string | null
  nombre: string
  rol: Rol
  tienePin: boolean
  tieneNfc: boolean
  nfcUid: string
  creado: string
}

const ROLES: Rol[] = ['admin', 'capturista', 'surtidor']

const formVacio = () => ({ nombre: '', rol: 'surtidor' as Rol, email: '', pin: '', nfcUid: '' })

export default function AdminUsuarios() {
  const queryClient = useQueryClient()
  const { data: usuarios = [], isLoading } = useQuery<UsuarioFila[]>({ queryKey: ['/api/usuarios'] })

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(formVacio())
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado('NDEFReader' in window)
  }, [])

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['/api/usuarios'] })

  const crearMutation = useMutation({
    mutationFn: async (body: unknown) => apiRequest('POST', '/api/usuarios', body),
    onSuccess: invalidar,
  })
  const editarMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: unknown }) => apiRequest('PATCH', `/api/usuarios/${id}`, body),
    onSuccess: invalidar,
  })
  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/usuarios/${id}`),
    onSuccess: invalidar,
  })

  const esOficina = form.rol === 'admin' || form.rol === 'capturista'

  function editarUsuario(u: UsuarioFila) {
    setEditandoId(u.id)
    setForm({ nombre: u.nombre || '', rol: u.rol, email: u.email || '', pin: '', nfcUid: u.nfcUid || '' })
    setError('')
    setExito('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(formVacio())
    setError('')
    setExito('')
  }

  async function escanearUid() {
    setError('')
    setEscaneando(true)
    try {
      // @ts-expect-error — Web NFC (NDEFReader) no está en los tipos de TS por defecto.
      const reader = new NDEFReader()
      await reader.scan()
      reader.onreading = (event: any) => {
        if (event.serialNumber) {
          setForm((prev) => ({ ...prev, nfcUid: event.serialNumber }))
        } else {
          setError('No se pudo leer el UID del tag')
        }
        setEscaneando(false)
      }
      reader.onreadingerror = () => {
        setError('Error al leer el tag NFC')
        setEscaneando(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el escaneo')
      setEscaneando(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setExito('')

    const nombre = form.nombre.trim()
    const email = form.email.trim()
    const pin = form.pin.trim()
    const nfcUid = form.nfcUid.trim()

    if (!nombre) return setError('Falta el nombre')
    if (esOficina && !email) return setError('admin/capturista necesitan email (entran por Nextcloud)')
    if (!esOficina && !pin && !nfcUid) return setError('Surtidor necesita PIN o tag NFC')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email inválido')
    if (pin && !/^\d{6,}$/.test(pin)) return setError('PIN debe ser mínimo 6 dígitos numéricos')

    try {
      if (editandoId) {
        await editarMutation.mutateAsync({
          id: editandoId,
          body: { nombre, rol: form.rol, email, nfcUid, ...(pin ? { pin } : {}) },
        })
        setExito('Usuario actualizado')
      } else {
        await crearMutation.mutateAsync({ nombre, rol: form.rol, email: esOficina ? email : '', pin: esOficina ? '' : pin, nfcUid: esOficina ? '' : nfcUid })
        setExito('Usuario agregado')
      }
      setForm(formVacio())
      setEditandoId(null)
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
    }
  }

  async function eliminar(u: UsuarioFila) {
    if (!confirm(`¿Eliminar a "${u.nombre || u.email || 'este usuario'}"?`)) return
    setEliminandoId(u.id)
    setError('')
    try {
      await eliminarMutation.mutateAsync(u.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar')
    } finally {
      setEliminandoId(null)
    }
  }

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Usuarios</h1>
        <p className="text-muted-foreground">Admin y capturista entran por Nextcloud (solo email). Surtidor entra por PIN y/o NFC.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">{editandoId ? 'Editar usuario' : 'Agregar usuario'}</h2>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="u-nombre">Nombre</Label>
              <Input id="u-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Juan Pérez" required />
            </div>

            <div className="space-y-1">
              <Label>Rol</Label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <label key={r} className={`min-h-11 cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold ${form.rol === r ? 'border-primary bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    <input type="radio" className="sr-only" name="rol" checked={form.rol === r} onChange={() => setForm({ ...form, rol: r })} />
                    {ROL_LABEL[r]}
                  </label>
                ))}
              </div>
            </div>

            {esOficina ? (
              <div className="space-y-1">
                <Label htmlFor="u-email">
                  Email <span className="text-xs text-muted-foreground">— identidad Nextcloud, obligatorio</span>
                </Label>
                <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@miglobal.com.mx" required />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="u-email-opt">Email <span className="text-xs text-muted-foreground">— opcional, solo referencia</span></Label>
                  <Input id="u-email-opt" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@correo.com" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="u-pin">
                    PIN <span className="text-xs text-muted-foreground">{editandoId ? '— deja vacío para no cambiarlo' : '— mínimo 6 dígitos'}</span>
                  </Label>
                  <Input id="u-pin" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder={editandoId ? 'Solo si quieres cambiarlo' : '123456'} inputMode="numeric" autoComplete="new-password" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="u-nfc">NFC UID <span className="text-xs text-muted-foreground">— opcional</span></Label>
                  <div className="flex gap-2">
                    <Input id="u-nfc" value={form.nfcUid} onChange={(e) => setForm({ ...form, nfcUid: e.target.value })} placeholder="04:35:28:92:6B:1C:90" />
                    {nfcSoportado && (
                      <Button type="button" variant="secondary" onClick={escanearUid} disabled={escaneando}>
                        {escaneando ? 'Acerca tag…' : 'Escanear'}
                      </Button>
                    )}
                  </div>
                  {!nfcSoportado && <p className="text-xs text-muted-foreground">Para escanear el UID, abre esta página en un Android con Chrome.</p>}
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> <span>{error}</span>
              </div>
            )}
            {exito && (
              <div className="flex items-center gap-2 rounded-md border border-success bg-success/10 p-2 text-sm text-success">
                <Check className="h-4 w-4 shrink-0" /> <span>{exito}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {editandoId && (
                <Button type="button" variant="secondary" onClick={cancelarEdicion}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={crearMutation.isPending || editarMutation.isPending}>
                {crearMutation.isPending || editarMutation.isPending ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar usuario'}
              </Button>
            </div>
          </form>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Usuarios registrados ({usuarios.length})</h2>
          {usuarios.length === 0 ? (
            <p className="text-muted-foreground">No hay usuarios todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Rol</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Login</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className={`border-b ${editandoId === u.id ? 'bg-secondary/50' : ''}`}>
                      <td className="p-2 font-semibold">{u.nombre || '—'}</td>
                      <td className="p-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold">{ROL_LABEL[u.rol]}</span>
                      </td>
                      <td className="p-2">{u.email || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {u.tienePin && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">PIN</span>}
                          {u.tieneNfc && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">NFC</span>}
                          {!u.tienePin && !u.tieneNfc && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => editarUsuario(u)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" disabled={eliminandoId === u.id} onClick={() => eliminar(u)}>
                            <Trash2 className="h-3.5 w-3.5" /> {eliminandoId === u.id ? '…' : 'Eliminar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
