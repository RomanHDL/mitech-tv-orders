'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LOGO_MITECH } from '@/lib/logo-mitech'

const LINKS_POR_ROL = {
  capturista: [
    { href: '/', label: 'Nuevo pedido' },
    { href: '/pedidos', label: 'Pedidos' },
  ],
  surtidor: [
    { href: '/surtir', label: 'Surtir' },
  ],
  admin: [
    { href: '/', label: 'Nuevo' },
    { href: '/pedidos', label: 'Pedidos' },
    { href: '/surtir', label: 'Surtir' },
    { href: '/admin/usuarios', label: 'Usuarios' },
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
              {l.label}
            </Link>
          ))}
          <span className={`nav-rol-badge rol-${rol}`}>{ROL_LABEL[rol]}</span>
          {displayName && <span className="nav-user-name">{displayName}</span>}
          <button onClick={logout} className="nav-logout" type="button">
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
