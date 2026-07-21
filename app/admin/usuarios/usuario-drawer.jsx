'use client'

import { useEffect, useRef } from 'react'
import { IconClose } from '../../components/icons'

const SELECTOR_FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Panel lateral genérico (drawer) para crear/editar un usuario. Contiene el
// <form> completo (header + contenido con scroll + barra de acciones fija)
// para que el botón de guardar pueda vivir en la barra inferior sin trucos
// de atributo `form=""`. Solo maneja la mecánica del panel (foco, Escape,
// backdrop, animación); los campos los da UsuarioForm como children.
export default function UsuarioDrawer({
  abierto,
  titulo,
  subtitulo,
  editando,
  enviando,
  onSubmit,
  onSolicitarCierre,
  focoInicialRef,
  bloqueado = false,
  children,
}) {
  const panelRef = useRef(null)
  const previoEnfocado = useRef(null)

  // Foco inicial + retorno de foco: al abrir, recuerda qué elemento tenía el
  // foco (el botón "Agregar usuario" o "Editar" que se pulsó) y mueve el foco
  // al campo Nombre (focoInicialRef) o, si no llega, al primer elemento
  // enfocable del panel. Al cerrarse, regresa el foco a ese elemento.
  useEffect(() => {
    if (!abierto) return
    previoEnfocado.current = document.activeElement
    const objetivo = focoInicialRef?.current || panelRef.current?.querySelector(SELECTOR_FOCUSABLE)
    objetivo?.focus()
    return () => {
      previoEnfocado.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Focus trap: mientras el panel está abierto, Tab/Shift+Tab nunca deben
  // salir de él. Escape cierra, salvo mientras se está guardando o mientras
  // haya una confirmación (descartar cambios) por encima que deba protegerse
  // — en ese caso el Escape lo maneja esa confirmación, no el panel.
  useEffect(() => {
    if (!abierto) return
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (enviando || bloqueado) return
        e.stopPropagation()
        onSolicitarCierre()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focosables = Array.from(panelRef.current.querySelectorAll(SELECTOR_FOCUSABLE))
      if (focosables.length === 0) return
      const primero = focosables[0]
      const ultimo = focosables[focosables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [abierto, enviando, bloqueado, onSolicitarCierre])

  if (!abierto) return null

  const puedeCerrar = !enviando && !bloqueado

  const onBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget && puedeCerrar) onSolicitarCierre()
  }

  return (
    <div className="drawer-overlay" onMouseDown={onBackdropMouseDown}>
      <aside
        className="drawer-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-titulo"
      >
        <form onSubmit={onSubmit} className="drawer-form">
          <div className="drawer-header">
            <div>
              <h2 id="drawer-titulo">{titulo}</h2>
              {subtitulo && <p className="drawer-subtitulo">{subtitulo}</p>}
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={() => puedeCerrar && onSolicitarCierre()}
              disabled={!puedeCerrar}
              aria-label="Cerrar"
            >
              <IconClose />
            </button>
          </div>

          <div className="drawer-body">{children}</div>

          <div className="drawer-footer">
            <button
              type="button"
              className="btn btn-secondary drawer-btn-cancelar"
              onClick={onSolicitarCierre}
              disabled={!puedeCerrar}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary drawer-btn-principal" disabled={enviando}>
              {enviando && <span className="spinner-sm" aria-hidden="true" />}
              {enviando ? (editando ? 'Guardando…' : 'Creando…') : (editando ? 'Guardar cambios' : 'Crear usuario')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
