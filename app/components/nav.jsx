'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import LanguageSwitcher from './language-switcher'

const LINKS_POR_ROL = {
  capturista: [
    { href: '/', labelKey: 'nav.nuevoPedido' },
    { href: '/pedidos', labelKey: 'nav.pedidos' },
    { href: '/historial', labelKey: 'nav.historial' },
    { href: '/surtir', labelKey: 'nav.validar' },
    { href: '/manual', labelKey: 'nav.manual' },
    { href: '/changelog', labelKey: 'nav.novedades' },
  ],
  surtidor: [
    { href: '/surtir', labelKey: 'nav.surtir' },
    { href: '/manual', labelKey: 'nav.manual' },
    { href: '/changelog', labelKey: 'nav.novedades' },
  ],
  admin: [
    { href: '/', labelKey: 'nav.nuevo' },
    { href: '/pedidos', labelKey: 'nav.pedidos' },
    { href: '/pedidos-live', labelKey: 'nav.pedidosLive' },
    { href: '/historial', labelKey: 'nav.historial' },
    { href: '/surtir', labelKey: 'nav.surtir' },
    { href: '/admin/catalogo-onn', labelKey: 'nav.catalogoOnn' },
    { href: '/admin/usuarios', labelKey: 'nav.usuarios' },
    { href: '/manual', labelKey: 'nav.manual' },
    { href: '/admin/manual', labelKey: 'nav.editarManual' },
    { href: '/admin/changelog', labelKey: 'nav.changelog' },
  ],
}

const ROL_LABEL = {
  admin: 'Admin',
  capturista: 'Capturista',
  surtidor: 'Surtidor',
}

export default function Nav({ rol, email, nombre }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()

  if (pathname.includes('/imprimir')) return null
  if (pathname === '/login') return null
  if (!rol) return null

  const links = LINKS_POR_ROL[rol] || []
  const displayName = nombre || (email ? email.split('@')[0] : '')

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
        <div className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={esActiva(l.href) ? 'activo' : ''}>
              {t(l.labelKey)}
            </Link>
          ))}
          <LanguageSwitcher />
          <span className={`nav-rol-badge rol-${rol}`}>{ROL_LABEL[rol]}</span>
          {displayName && <span className="nav-user-name">{displayName}</span>}
          <button onClick={logout} className="nav-logout" type="button">
            {t('nav.salir')}
          </button>
        </div>
      </div>
    </nav>
  )
}
