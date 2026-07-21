'use client'

import { useEffect, useRef } from 'react'

// Diálogo de confirmación pequeño y genérico — lo reutilizan tanto
// "descartar cambios sin guardar" como "eliminar usuario", para no duplicar
// la misma mecánica (overlay, Escape, foco inicial) dos veces.
export default function ConfirmarDialog({
  titulo,
  texto,
  labelConfirmar,
  labelCancelar = 'Cancelar',
  peligroso = false,
  cargando = false,
  error = '',
  onConfirmar,
  onCancelar,
}) {
  const botonCancelarRef = useRef(null)

  useEffect(() => {
    botonCancelarRef.current?.focus()
    function onKeyDown(e) {
      if (e.key === 'Escape' && !cargando) {
        e.stopPropagation()
        onCancelar()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget && !cargando) onCancelar()
  }

  return (
    <div className="confirmar-overlay" onMouseDown={onBackdropMouseDown}>
      <div className="confirmar-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo">
        <h3 id="confirmar-titulo">{titulo}</h3>
        <p>{texto}</p>
        {error && (
          <div className="alerta alerta-error">
            <span>{error}</span>
          </div>
        )}
        <div className="confirmar-acciones">
          <button
            type="button"
            ref={botonCancelarRef}
            className="btn btn-secondary"
            onClick={onCancelar}
            disabled={cargando}
          >
            {labelCancelar}
          </button>
          <button
            type="button"
            className={`btn ${peligroso ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirmar}
            disabled={cargando}
          >
            {cargando && <span className="spinner-sm" aria-hidden="true" />}
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
