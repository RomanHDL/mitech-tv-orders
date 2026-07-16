// Nav basada en rol — equivalente a app/components/nav.jsx del app original.
// Se oculta en /login y en la vista de impresión (sin nav ni botones al imprimir).
import { Link, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/use-auth'
import { ROL_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/language-switcher'
import type { Rol } from '@shared/schema'

const LINKS: Record<Rol, { href: string; key: string }[]> = {
  admin: [
    { href: '/', key: 'nav.nuevoPedido' },
    { href: '/pedidos', key: 'nav.pedidos' },
    { href: '/surtir', key: 'nav.surtir' },
    { href: '/historial', key: 'nav.historial' },
    { href: '/pedidos-live', key: 'nav.pedidosEnVivo' },
    { href: '/admin/usuarios', key: 'nav.usuarios' },
    { href: '/admin/catalogo-onn', key: 'nav.catalogoOnn' },
  ],
  capturista: [
    { href: '/', key: 'nav.nuevoPedido' },
    { href: '/pedidos', key: 'nav.pedidos' },
    { href: '/surtir', key: 'nav.surtir' },
  ],
  surtidor: [{ href: '/surtir', key: 'nav.surtir' }],
}

export default function Nav() {
  const { usuario, logout } = useAuth()
  const [location, setLocation] = useLocation()
  const { t } = useTranslation()

  if (!usuario) return null
  if (location === '/login' || /\/imprimir$/.test(location)) return null

  const links = LINKS[usuario.rol] || []

  return (
    <header className="border-b bg-card">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 p-3 sm:gap-4">
        <span className="font-display text-lg text-primary">{t('app.nombre')}</span>
        <div className="flex flex-1 flex-wrap gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              <a className="rounded-md px-3 py-2 text-sm hover:bg-secondary">{t(l.key)}</a>
            </Link>
          ))}
        </div>
        <LanguageSwitcher />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {usuario.nombre} · {t(`roles.${usuario.rol}`, ROL_LABEL[usuario.rol])}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await logout()
            setLocation('/login')
          }}
        >
          {t('nav.salir')}
        </Button>
      </nav>
    </header>
  )
}
