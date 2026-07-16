// Nav basada en rol — equivalente a app/components/nav.jsx del app original.
// Se oculta en /login y en la vista de impresión (sin nav ni botones al imprimir).
import { Link, useLocation } from 'wouter'
import { useAuth } from '@/hooks/use-auth'
import { ROL_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/button'

const LINKS: Record<string, { href: string; label: string }[]> = {
  admin: [
    { href: '/', label: 'Nuevo pedido' },
    { href: '/pedidos', label: 'Pedidos' },
    { href: '/surtir', label: 'Surtir' },
    { href: '/historial', label: 'Historial' },
    { href: '/pedidos-live', label: 'Pedidos en vivo' },
    { href: '/admin/usuarios', label: 'Usuarios' },
    { href: '/admin/catalogo-onn', label: 'Catálogo ONN' },
  ],
  capturista: [
    { href: '/', label: 'Nuevo pedido' },
    { href: '/pedidos', label: 'Pedidos' },
    { href: '/surtir', label: 'Surtir' },
  ],
  surtidor: [{ href: '/surtir', label: 'Surtir' }],
}

export default function Nav() {
  const { usuario, logout } = useAuth()
  const [location, setLocation] = useLocation()

  if (!usuario) return null
  if (location === '/login' || /\/imprimir$/.test(location)) return null

  const links = LINKS[usuario.rol] || []

  return (
    <header className="border-b bg-card">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 p-3 sm:gap-4">
        <span className="font-display text-lg text-primary">MiTech Pedidos</span>
        <div className="flex flex-1 flex-wrap gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <a className="rounded-md px-3 py-2 text-sm hover:bg-secondary">{l.label}</a>
            </Link>
          ))}
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {usuario.nombre} · {ROL_LABEL[usuario.rol]}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await logout()
            setLocation('/login')
          }}
        >
          Salir
        </Button>
      </nav>
    </header>
  )
}
