'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import LanguageSwitcher from './language-switcher'
import { IconChevronDown, IconClose, IconMenu } from './icons'

const LINKS_POR_ROL = {
  capturista: [
    { href: '/', labelKey: 'nav.nuevoPedido', moduleId: 'new-order' },
    { href: '/pedidos', labelKey: 'nav.pedidos', moduleId: 'orders' },
    { href: '/historial', labelKey: 'nav.historial', moduleId: 'history' },
    { href: '/surtir', labelKey: 'nav.validar', moduleId: 'picking' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual' },
    { href: '/changelog', labelKey: 'nav.novedades', moduleId: 'changelog' },
  ],
  surtidor: [
    { href: '/surtir', labelKey: 'nav.surtir', moduleId: 'picking' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual' },
    { href: '/changelog', labelKey: 'nav.novedades', moduleId: 'changelog' },
  ],
  admin: [
    { href: '/', labelKey: 'nav.nuevo', moduleId: 'new-order' },
    { href: '/pedidos', labelKey: 'nav.pedidos', moduleId: 'orders' },
    { href: '/pedidos-live', labelKey: 'nav.pedidosLive', moduleId: 'live-orders' },
    { href: '/historial', labelKey: 'nav.historial', moduleId: 'history' },
    { href: '/surtir', labelKey: 'nav.surtir', moduleId: 'picking' },
    { href: '/admin/catalogo-onn', labelKey: 'nav.catalogoOnn', moduleId: 'onn-catalog' },
    { href: '/admin/usuarios', labelKey: 'nav.usuarios', moduleId: 'users' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual' },
    { href: '/admin/manual', labelKey: 'nav.editarManual', moduleId: 'manual-editor' },
    { href: '/admin/changelog', labelKey: 'nav.changelog', moduleId: 'changelog' },
  ],
}

const ROL_LABEL = {
  admin: 'Admin',
  capturista: 'Capturista',
  surtidor: 'Surtidor',
}

export default function Nav({ rol, email, nombre, allowedModules }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
  const usuarioMenuRef = useRef(null)

  // Cierra ambos menús al navegar a otra ruta.
  useEffect(() => {
    setMenuMovilAbierto(false)
    setMenuUsuarioAbierto(false)
  }, [pathname])

  // Cierra el menú de usuario al hacer clic fuera, y ambos con Escape —
  // mismo patrón que ya usa el modal de changelog.
  useEffect(() => {
    function onClickFuera(e) {
      if (usuarioMenuRef.current && !usuarioMenuRef.current.contains(e.target)) {
        setMenuUsuarioAbierto(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuUsuarioAbierto(false)
        setMenuMovilAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (pathname.includes('/imprimir')) return null
  if (pathname === '/login') return null
  if (!rol) return null

  // Menú dinámico: solo los módulos que el usuario tiene realmente
  // permitidos (allowedModules), conservando el orden de siempre por rol.
  // Si por algún motivo allowedModules no llegó (no debería pasar, getUsuario
  // siempre da al menos el default del rol), se muestra la lista completa
  // del rol como antes — nunca un menú vacío.
  const linksDelRol = LINKS_POR_ROL[rol] || []
  const links = Array.isArray(allowedModules)
    ? linksDelRol.filter((l) => allowedModules.includes(l.moduleId))
    : linksDelRol
  const displayName = nombre || (email ? email.split('@')[0] : '')
  const inicial = (displayName || rol || '?').charAt(0).toUpperCase()

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    router.push('/login')
    router.refresh()
  }

  const esActiva = (href) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href={links[0]?.href || '/login'} className="nav-logo" aria-label="MiTechnologies">
          <span className="nav-logo-icon">
            <img src={LOGO_MITECH} alt="MiTechnologies" width="120" height="38" />
          </span>
        </Link>

        <div className="nav-links nav-links-escritorio">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={esActiva(l.href) ? 'activo' : ''}>
              {t(l.labelKey)}
            </Link>
          ))}
        </div>

        <div className="nav-right">
          <LanguageSwitcher />

          <div className="nav-usuario" ref={usuarioMenuRef}>
            <button
              type="button"
              className="nav-usuario-btn"
              onClick={() => setMenuUsuarioAbierto((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuUsuarioAbierto}
              aria-label="Menú de usuario"
            >
              <span className="nav-avatar">{inicial}</span>
              <IconChevronDown width={14} height={14} />
            </button>

            {menuUsuarioAbierto && (
              <div className="nav-usuario-menu" role="menu">
                <div className="nav-usuario-menu-header">
                  {displayName && <div className="nav-usuario-menu-nombre">{displayName}</div>}
                  <span className={`nav-rol-badge rol-${rol}`}>{ROL_LABEL[rol]}</span>
                </div>
                <button onClick={logout} className="nav-usuario-menu-salir" type="button" role="menuitem">
                  {t('nav.salir')}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="nav-hamburguesa"
            onClick={() => setMenuMovilAbierto((v) => !v)}
            aria-label="Menú"
            aria-expanded={menuMovilAbierto}
          >
            {menuMovilAbierto ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {menuMovilAbierto && (
        <div className="nav-links-movil">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={esActiva(l.href) ? 'activo' : ''}>
              {t(l.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
