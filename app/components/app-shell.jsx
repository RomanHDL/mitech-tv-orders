'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import LanguageSwitcher from './language-switcher'
import {
  IconActivity,
  IconBox,
  IconChevronDown,
  IconClipboardList,
  IconClock,
  IconClose,
  IconDocument,
  IconForklift,
  IconMenu,
  IconMoon,
  IconPencil,
  IconPin,
  IconPinOff,
  IconPlus,
  IconRefresh,
  IconSun,
  IconUser,
} from './icons'

const TEMA_KEY = 'mitech-theme'
const PIN_KEY = 'mitech-sidebar-pinned'
const CIERRE_AUTO_MS = 250

// Un ícono por módulo — mismo id estable de lib/modulos.js, para que el
// menú luzca "ícono + etiqueta" sin repetir imports por rol.
const ICONO_MODULO = {
  'new-order': IconPlus,
  orders: IconClipboardList,
  'live-orders': IconActivity,
  history: IconClock,
  picking: IconForklift,
  'onn-catalog': IconBox,
  users: IconUser,
  manual: IconDocument,
  'manual-editor': IconPencil,
  changelog: IconRefresh,
}

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

function Logo({ href, t }) {
  return (
    <Link href={href || '/login'} className="sidebar-logo" aria-label="MiTechnologies">
      <span className="sidebar-logo-badge">
        <img src={LOGO_MITECH} alt="MiTechnologies" width="120" height="38" />
      </span>
    </Link>
  )
}

export default function AppShell({ rol, email, nombre, allowedModules, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
  const [pinned, setPinned] = useState(true)
  const [open, setOpen] = useState(false)
  const [oscuro, setOscuro] = useState(false)
  const usuarioMenuRef = useRef(null)
  const cierreTimer = useRef(null)

  // Lee las preferencias guardadas (tema y fijado de la barra) una vez
  // montado — un pequeño flash inicial en los valores por defecto (claro,
  // fijada) es aceptable, no se usa script bloqueante para esto.
  useEffect(() => {
    try {
      const pinGuardado = localStorage.getItem(PIN_KEY)
      if (pinGuardado !== null) setPinned(pinGuardado === 'true')
    } catch {}
    try {
      setOscuro(document.documentElement.getAttribute('data-theme') === 'dark')
    } catch {}
  }, [])

  // Cierra menús/drawer al navegar a otra ruta.
  useEffect(() => {
    setMenuMovilAbierto(false)
    setMenuUsuarioAbierto(false)
    setOpen(false)
  }, [pathname])

  // Cierra el menú de usuario al hacer clic fuera, y todo con Escape.
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
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => () => {
    if (cierreTimer.current) clearTimeout(cierreTimer.current)
  }, [])

  const ocultar = !rol || pathname.includes('/imprimir') || pathname === '/login'

  if (ocultar) return <>{children}</>

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

  function abrirAuto() {
    if (cierreTimer.current) {
      clearTimeout(cierreTimer.current)
      cierreTimer.current = null
    }
    setOpen(true)
  }

  function programarCierreAuto() {
    if (cierreTimer.current) clearTimeout(cierreTimer.current)
    cierreTimer.current = setTimeout(() => setOpen(false), CIERRE_AUTO_MS)
  }

  function alternarFijado() {
    setPinned((v) => {
      const siguiente = !v
      try {
        localStorage.setItem(PIN_KEY, String(siguiente))
      } catch {}
      return siguiente
    })
    setOpen(false)
  }

  function alternarTema() {
    setOscuro((v) => {
      const siguiente = !v
      try {
        document.documentElement.setAttribute('data-theme', siguiente ? 'dark' : 'light')
        localStorage.setItem(TEMA_KEY, siguiente ? 'dark' : 'light')
      } catch {}
      return siguiente
    })
  }

  const linksNav = (
    <>
      {links.map((l) => {
        const Icono = ICONO_MODULO[l.moduleId]
        return (
          <Link key={l.href} href={l.href} className={esActiva(l.href) ? 'activo' : ''}>
            {Icono && <Icono className="sidebar-link-icono" />}
            <span>{t(l.labelKey)}</span>
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="app-shell" data-pinned={pinned} data-open={open} data-mobile-open={menuMovilAbierto}>
      <div className="sidebar-trigger" onMouseEnter={abrirAuto} aria-hidden="true" />

      <aside className="sidebar" onMouseEnter={abrirAuto} onMouseLeave={programarCierreAuto}>
        <div className="sidebar-header">
          <Logo href={links[0]?.href} t={t} />
          <button
            type="button"
            className="sidebar-pin-btn"
            onClick={alternarFijado}
            aria-pressed={pinned}
            title={pinned ? t('nav.autoOcultarBarra') : t('nav.fijarBarra')}
          >
            {pinned ? <IconPin /> : <IconPinOff />}
          </button>
        </div>

        <nav className="sidebar-links">{linksNav}</nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <LanguageSwitcher className="sidebar-lang" />
            <button
              type="button"
              className="sidebar-theme-btn"
              onClick={alternarTema}
              aria-label={oscuro ? t('nav.temaClaro') : t('nav.temaOscuro')}
              title={oscuro ? t('nav.temaClaro') : t('nav.temaOscuro')}
            >
              {oscuro ? <IconSun /> : <IconMoon />}
            </button>
          </div>

          <div className="nav-usuario" ref={usuarioMenuRef}>
            <button
              type="button"
              className="nav-usuario-btn"
              onClick={() => setMenuUsuarioAbierto((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuUsuarioAbierto}
              aria-label={t('usuarios.menuUsuario')}
            >
              <span className="nav-avatar">{inicial}</span>
              <span className="nav-usuario-nombre-corto">{displayName || rol}</span>
              <IconChevronDown width={14} height={14} />
            </button>

            {menuUsuarioAbierto && (
              <div className="nav-usuario-menu" role="menu">
                <div className="nav-usuario-menu-header">
                  {displayName && <div className="nav-usuario-menu-nombre">{displayName}</div>}
                  <span className={`nav-rol-badge rol-${rol}`}>{t(`usuarios.rol${rol.charAt(0).toUpperCase()}${rol.slice(1)}`)}</span>
                </div>
                <button onClick={logout} className="nav-usuario-menu-salir" type="button" role="menuitem">
                  {t('nav.salir')}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="mobile-topbar">
        <button
          type="button"
          className="sidebar-hamburguesa"
          onClick={() => setMenuMovilAbierto((v) => !v)}
          aria-label={t('usuarios.menu')}
          aria-expanded={menuMovilAbierto}
        >
          {menuMovilAbierto ? <IconClose /> : <IconMenu />}
        </button>
        <Logo href={links[0]?.href} t={t} />
      </div>

      <div
        className="sidebar-backdrop"
        onClick={() => {
          setOpen(false)
          setMenuMovilAbierto(false)
        }}
      />

      <main className="app-main">{children}</main>
    </div>
  )
}
