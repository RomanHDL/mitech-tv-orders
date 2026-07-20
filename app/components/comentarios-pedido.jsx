'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconCheck, IconMessage } from './icons'

const MAX = 2000

function fmtFecha(iso) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
}) {
  const { t } = useTranslation()
  const [valor, setValor] = useState(comentariosIniciales || '')
  const [estado, setEstado] = useState('idle') // idle | guardando | guardado | error
  const [error, setError] = useState('')
  const [metaActualizado, setMetaActualizado] = useState(actualizadoIso)
  const [metaPor, setMetaPor] = useState(actualizadoPorNombre)
  const ultimoGuardado = useRef(comentariosIniciales || '')
  const debounceTimer = useRef(null)
  const idleTimer = useRef(null)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  const guardar = async (texto) => {
    if (texto === ultimoGuardado.current) return
    setEstado('guardando')
    setError('')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/comentarios`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentarios: texto }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo guardar')
      }
      const data = await res.json().catch(() => ({}))
      ultimoGuardado.current = texto
      setMetaActualizado(data.actualizado || new Date().toISOString())
      setMetaPor(data.actualizadoPorNombre || null)
      setEstado('guardado')
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setEstado('idle'), 2500)
    } catch (err) {
      setError(err.message)
      setEstado('error')
    }
  }

  const onChange = (e) => {
    const texto = e.target.value.slice(0, MAX)
    setValor(texto)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => guardar(texto), 800)
  }

  const onBlur = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    guardar(valor)
  }

  const fechaTxt = fmtFecha(metaActualizado)

  return (
    <section className="comentarios-pedido">
      <div className="comentarios-header">
        <span className="comentarios-titulo">
          <IconMessage />
          {t('comentarios.titulo')}
        </span>
        {estado !== 'idle' && (
          <span className={`save-status save-status-${estado}`}>
            {estado === 'guardando' && (
              <>
                <span className="save-dot" />
                {t('common.guardando')}
              </>
            )}
            {estado === 'guardado' && (
              <>
                <IconCheck width={14} height={14} />
                Guardado
              </>
            )}
            {estado === 'error' && (
              <>
                <IconAlert width={14} height={14} />
                Error
              </>
            )}
          </span>
        )}
      </div>
      <textarea
        className="comentarios-textarea"
        value={valor}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={t('comentarios.placeholder')}
        rows={3}
        maxLength={MAX}
      />
      <div className="comentarios-footer">
        <span className="comentarios-contador">
          {valor.length}/{MAX}
        </span>
        {fechaTxt && (
          <span className="comentarios-meta">
            {t('comentarios.ultimaEdicion', { fecha: fechaTxt })}
            {metaPor ? ` · ${metaPor}` : ''}
          </span>
        )}
      </div>
      {error && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
