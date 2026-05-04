'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()
  if (pathname.includes('/imprimir')) return null

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">MiTech Pedidos</Link>
        <div className="nav-links">
          <Link href="/" className={pathname === '/' ? 'activo' : ''}>Nuevo pedido</Link>
          <Link href="/pedidos" className={pathname === '/pedidos' ? 'activo' : ''}>Ver pedidos</Link>
        </div>
      </div>
    </nav>
  )
}
