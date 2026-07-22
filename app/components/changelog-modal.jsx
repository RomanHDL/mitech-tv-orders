'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { categoriaLabel, prioridadLabel } from '@/lib/changelog'
import { IconCheck, IconClose } from './icons'

// Modal global de "novedades": se monta una vez en el layout raíz y consulta
// si hay una entrada de changelog que este usuario aún no haya descartado.
// No bloquea nada de la app si falla — silencioso ante error de red.
export default function ChangelogModal({ rol }) {
  const { t } = useTranslation()
  const [entrada, setEntrada] = useState(null)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    if (!rol) return
    let cancelado = false
    fetch('/api/changelog/latest')
      .then((res) => (res.ok ? res.json() : { entrada: null }))
      .then((data) => {
        if (!cancelado) setEntrada(data.entrada || null)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [rol])

  if (!entrada) return null

  const cerrar = async () => {
    setCerrando(true)
    try {
      await fetch(`/api/changelog/${entrada._id}/dismiss`, { method: 'POST' })
    } catch {
      // Si falla, simplemente se le volverá a mostrar la próxima vez — no es grave.
    }
    setEntrada(null)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}>
      <div className="modal changelog-modal" role="dialog" aria-modal="true" aria-label={t('changelog.novedadesTitulo')}>
        <div className="modal-header">
          <h2>{t('changelog.novedadesVersion', { version: entrada.version })}</h2>
          <button type="button" className="modal-close" onClick={cerrar} aria-label={t('common.cerrar')}>
            <IconClose />
          </button>
        </div>
        <div className="modal-body">
          <div className="changelog-modal-meta">
            <span className={`tag tag-cat-${entrada.categoria}`}>{categoriaLabel(t, entrada.categoria)}</span>
            <span className={`tag tag-pri-${entrada.prioridad}`}>{prioridadLabel(t, entrada.prioridad)}</span>
          </div>
          <h3 className="changelog-modal-titulo">{entrada.titulo}</h3>
          {entrada.items?.length > 0 && (
            <ul className="changelog-modal-items">
              {entrada.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-primary btn-large" onClick={cerrar} disabled={cerrando}>
            <IconCheck />
            {t('common.entendido')}
          </button>
        </div>
      </div>
    </div>
  )
}
