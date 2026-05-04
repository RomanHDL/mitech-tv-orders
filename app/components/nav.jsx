'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()
  if (pathname.includes('/imprimir')) return null

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-icon">MT</span>
          <span>MiTech Pedidos</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className={pathname === '/' ? 'activo' : ''}>
            Nuevo pedido
          </Link>
          <Link href="/pedidos" className={pathname === '/pedidos' ? 'activo' : ''}>
            Pedidos
          </Link>
          <Link href="/surtir" className={pathname.startsWith('/surtir') ? 'activo' : ''}>
            Surtir
          </Link>
        </div>
      </div>
    </nav>
  )
}
