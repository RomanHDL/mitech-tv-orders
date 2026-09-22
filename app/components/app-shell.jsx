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
  IconChevronsLeft,
  IconClipboardList,
  IconClock,
  IconClose,
  IconDocument,
  IconForklift,
  IconGlobe,
  IconMenu,
  IconMoon,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSun,
  IconUser,
} from './icons'

const TEMA_KEY = 'mitech-theme'
const COLAPSADA_KEY = 'mitech-sidebar-collapsed'
const LOGO_ICONO_COMPACTO = '/mitech-icon.png'

// El sistema todavía no expone si hay pedidos activos ahora mismo (AppShell
// es solo navegación, no hace fetch de pedidos) — el punto se deja como
// indicador visual fijo de "esta sección es de monitoreo en vivo". Cuando
// haya una fuente real (p.ej. un conteo en vivo), cambiar esta constante
// por esa condición.
const MOSTRAR_INDICADOR_PEDIDOS_VIVO = true

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

// `group` es puramente visual (agrupa la barra en secciones) — no afecta
// rutas, permisos ni el orden ya usado dentro de cada rol.
const LINKS_POR_ROL = {
  capturista: [
    { href: '/', labelKey: 'nav.nuevoPedido', moduleId: 'new-order', group: 'operacion' },
    { href: '/pedidos', labelKey: 'nav.pedidos', moduleId: 'orders', group: 'operacion' },
    { href: '/historial', labelKey: 'nav.historial', moduleId: 'history', group: 'control' },
    { href: '/surtir', labelKey: 'nav.validar', moduleId: 'picking', group: 'operacion' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual', group: 'soporte' },
    { href: '/changelog', labelKey: 'nav.novedades', moduleId: 'changelog', group: 'soporte' },
  ],
  surtidor: [
    { href: '/surtir', labelKey: 'nav.surtir', moduleId: 'picking', group: 'operacion' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual', group: 'soporte' },
    { href: '/changelog', labelKey: 'nav.novedades', moduleId: 'changelog', group: 'soporte' },
  ],
  admin: [
    { href: '/', labelKey: 'nav.nuevo', moduleId: 'new-order', group: 'operacion' },
    { href: '/pedidos', labelKey: 'nav.pedidos', moduleId: 'orders', group: 'operacion' },
    { href: '/pedidos-live', labelKey: 'nav.pedidosLive', moduleId: 'live-orders', group: 'operacion' },
    { href: '/surtir', labelKey: 'nav.surtir', moduleId: 'picking', group: 'operacion' },
    { href: '/historial', labelKey: 'nav.historial', moduleId: 'history', group: 'control' },
    { href: '/admin/catalogo-onn', labelKey: 'nav.catalogoOnn', moduleId: 'onn-catalog', group: 'control' },
    { href: '/admin/usuarios', labelKey: 'nav.usuarios', moduleId: 'users', group: 'administracion' },
    { href: '/manual', labelKey: 'nav.manual', moduleId: 'manual', group: 'soporte' },
    { href: '/admin/manual', labelKey: 'nav.editarManual', moduleId: 'manual-editor', group: 'soporte' },
    { href: '/admin/changelog', labelKey: 'nav.changelog', moduleId: 'changelog', group: 'soporte' },
  ],
}

const GRUPO_LABEL_KEY = {
  operacion: 'nav.grupoOperacion',
  control: 'nav.grupoControl',
  administracion: 'nav.grupoAdministracion',
  soporte: 'nav.grupoSoporte',
}

// Agrupa la lista (ya filtrada por rol/permisos) en bloques consecutivos
// del mismo `group`, conservando el orden original — no reordena ni
// mezcla módulos de grupos no contiguos.
function agruparLinks(links) {
  const grupos = []
  for (const link of links) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.group === link.group) {
      ultimo.items.push(link)
    } else {
      grupos.push({ group: link.group, items: [link] })
    }
  }
  return grupos
}

function Logo({ href, colapsada }) {
  return (
    <Link href={href || '/login'} className="sidebar-logo" aria-label="MiTechnologies">
      <span className="sidebar-logo-badge">
        {colapsada ? (
          <img src={LOGO_ICONO_COMPACTO} alt="MiTechnologies" width="26" height="26" />
        ) : (
          <img src={LOGO_MITECH} alt="MiTechnologies" width="120" height="38" />
        )}
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
  const [colapsada, setColapsada] = useState(true)
  const [peek, setPeek] = useState(false)
  const [oscuro, setOscuro] = useState(false)
  const [changelogNuevo, setChangelogNuevo] = useState(false)
  const usuarioMenuRef = useRef(null)
  const peekTimer = useRef(null)

  // Lee las preferencias guardadas (tema y colapso de la barra) una vez
  // montado — un pequeño flash inicial en los valores por defecto (claro,
  // expandida) es aceptable, no se usa script bloqueante para esto.
  useEffect(() => {
    try {
      const colapsadaGuardada = localStorage.getItem(COLAPSADA_KEY)
      if (colapsadaGuardada !== null) setColapsada(colapsadaGuardada === 'true')
    } catch {}
    try {
      setOscuro(document.documentElement.getAttribute('data-theme') === 'dark')
    } catch {}
  }, [])

  // Reutiliza la misma fuente que ya usa ChangelogModal (GET
  // /api/changelog/latest, entrada = null cuando no hay nada sin
  // descartar) solo para decidir si mostrar el badge "Nuevo" — no toca la
  // API ni la lógica de descarte, que sigue viviendo en ChangelogModal.
  useEffect(() => {
    if (!rol) return
    let cancelado = false
    fetch('/api/changelog/latest')
      .then((res) => (res.ok ? res.json() : { entrada: null }))
      .then((data) => {
        if (!cancelado) setChangelogNuevo(Boolean(data.entrada))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [rol])

  // Cierra menús/drawer al navegar a otra ruta.
  useEffect(() => {
    setMenuMovilAbierto(false)
    setMenuUsuarioAbierto(false)
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
    if (peekTimer.current) clearTimeout(peekTimer.current)
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
  const gruposLinks = agruparLinks(links)
  const displayName = nombre || (email ? email.split('@')[0] : '')
  const inicial = (displayName || rol || '?').charAt(0).toUpperCase()
  const rolLabel = rol ? t(`usuarios.rol${rol.charAt(0).toUpperCase()}${rol.slice(1)}`) : ''

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

  function alternarColapso() {
    setColapsada((v) => {
      const siguiente = !v
      try {
        localStorage.setItem(COLAPSADA_KEY, String(siguiente))
      } catch {}
      return siguiente
    })
    setMenuUsuarioAbierto(false)
  }

  // Peek: al pasar el mouse sobre la barra ya contraída (solo iconos), se
  // ve temporalmente expandida (overlay) sin mover el contenido — el
  // colapso "real" que gobierna el margin-left de .app-main no cambia.
  // Solo aplica si el usuario la dejó contraída; si ya la fijó expandida
  // manualmente, el hover no hace nada.
  function abrirPeek() {
    if (!colapsada) return
    if (peekTimer.current) {
      clearTimeout(peekTimer.current)
      peekTimer.current = null
    }
    setPeek(true)
  }

  function programarCierrePeek() {
    if (peekTimer.current) clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setPeek(false), 200)
  }

  const mostrarCompacta = colapsada && !peek

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

  return (
    <div className="app-shell" data-collapsed={colapsada} data-mobile-open={menuMovilAbierto}>
      <aside
        className="sidebar"
        data-collapsed={colapsada}
        data-visual-collapsed={mostrarCompacta}
        onMouseEnter={abrirPeek}
        onMouseLeave={programarCierrePeek}
      >
        <div className="sidebar-header">
          <Logo href={links[0]?.href} colapsada={mostrarCompacta} />
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={alternarColapso}
            aria-pressed={colapsada}
            aria-label={colapsada ? t('nav.expandirBarra') : t('nav.colapsarBarra')}
            title={colapsada ? t('nav.expandirBarra') : t('nav.colapsarBarra')}
          >
            <IconChevronsLeft className="sidebar-collapse-icon" />
          </button>
        </div>

        <nav className="sidebar-links">
          {gruposLinks.map((grupo) => (
            <div className="sidebar-group" key={grupo.group}>
              <p className="sidebar-group-title">{t(GRUPO_LABEL_KEY[grupo.group])}</p>
              {grupo.items.map((l) => {
                const Icono = ICONO_MODULO[l.moduleId]
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={esActiva(l.href) ? 'activo' : ''}
                    title={mostrarCompacta ? t(l.labelKey) : undefined}
                  >
                    <span className="sidebar-link-icon-wrap">
                      {Icono && <Icono className="sidebar-link-icono" />}
                    </span>
                    <span className="sidebar-link-texto">{t(l.labelKey)}</span>
                    {l.moduleId === 'live-orders' && MOSTRAR_INDICADOR_PEDIDOS_VIVO && (
                      <span className="sidebar-live-dot" aria-hidden="true" />
                    )}
                    {l.moduleId === 'changelog' && changelogNuevo && (
                      <span className="sidebar-badge-nuevo">{t('nav.changelogNuevo')}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <span className="sidebar-lang-pill">
              <IconGlobe className="sidebar-lang-pill-icon" aria-hidden="true" />
              <LanguageSwitcher className="sidebar-lang" />
            </span>
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
              <span className="nav-usuario-info">
                <span className="nav-usuario-nombre-corto">{displayName || rol}</span>
                <span className="nav-usuario-rol-corto">{rolLabel}</span>
              </span>
              <IconChevronDown width={14} height={14} className="nav-usuario-chevron" />
            </button>

            {menuUsuarioAbierto && (
              <div className="nav-usuario-menu" role="menu">
                <div className="nav-usuario-menu-header">
                  {displayName && <div className="nav-usuario-menu-nombre">{displayName}</div>}
                  <span className={`nav-rol-badge rol-${rol}`}>{rolLabel}</span>
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
        <Logo href={links[0]?.href} colapsada={false} />
      </div>

      <div className="sidebar-backdrop" onClick={() => setMenuMovilAbierto(false)} />

      <main className="app-main">{children}</main>
    </div>
  )
}
