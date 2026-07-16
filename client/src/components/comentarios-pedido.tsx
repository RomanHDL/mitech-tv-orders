// Puerto de app/components/comentarios-pedido.jsx — textarea autoguardado
// (debounce 800ms + guardar en blur) con estado idle/guardando/guardado/error.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Check, AlertCircle } from 'lucide-react'
import { apiRequest, ApiError } from '@/lib/queryClient'

const MAX = 2000

function fmtFecha(iso: string | null) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

export default function ComentariosPedido({
  pedidoId,
  comentariosIniciales = '',
  actualizadoIso = null,
  actualizadoPorNombre = null,
}: {
  pedidoId: string
  comentariosIniciales?: string
  actualizadoIso?: string | null
  actualizadoPorNombre?: string | null
}) {
  const { t } = useTranslation()
  const [valor, setValor] = useState(comentariosIniciales)
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'guardado' | 'error'>('idle')
  const [error, setError] = useState('')
  const [metaActualizado, setMetaActualizado] = useState(actualizadoIso)
  const [metaPor, setMetaPor] = useState(actualizadoPorNombre)
  const ultimoGuardado = useRef(comentariosIniciales)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimer.current)
      clearTimeout(idleTimer.current)
    }
  }, [])

  const guardar = async (texto: string) => {
    if (texto === ultimoGuardado.current) return
    setEstado('guardando')
    setError('')
    try {
      const res = await apiRequest('PATCH', `/api/pedidos/${pedidoId}/comentarios`, { comentarios: texto })
      const data = await res.json()
      ultimoGuardado.current = texto
      setMetaActualizado(data.actualizado || new Date().toISOString())
      setMetaPor(data.actualizadoPorNombre || null)
      setEstado('guardado')
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setEstado('idle'), 2500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.errGuardar'))
      setEstado('error')
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const texto = e.target.value.slice(0, MAX)
    setValor(texto)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => guardar(texto), 800)
  }

  const onBlur = () => {
    clearTimeout(debounceTimer.current)
    guardar(valor)
  }

  const fechaTxt = fmtFecha(metaActualizado)

  return (
    <section className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="h-4 w-4" /> {t('comentarios.titulo')}
        </span>
        {estado !== 'idle' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {estado === 'guardando' && <>{t('common.guardando')}</>}
            {estado === 'guardado' && (
              <>
                <Check className="h-3.5 w-3.5 text-success" /> {t('common.guardado')}
              </>
            )}
            {estado === 'error' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" /> {t('common.error')}
              </>
            )}
          </span>
        )}
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={valor}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={t('comentarios.placeholder')}
        rows={3}
        maxLength={MAX}
      />
      <div className="mt-1 flex flex-wrap justify-between text-xs text-muted-foreground">
        <span>
          {valor.length}/{MAX}
        </span>
        {fechaTxt && <span>{t('comentarios.ultimaEdicion', { fecha: fechaTxt, por: metaPor ? ` · ${metaPor}` : '' })}</span>}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
