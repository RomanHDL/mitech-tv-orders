// Nav basada en rol — equivalente a app/components/nav.jsx del app original.
// Se oculta en /login y en la vista de impresión (sin nav ni botones al imprimir).
import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import {
  FilePlus2,
  ListChecks,
  PackageCheck,
  History,
  Radio,
  Users,
  Tv,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ROL_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/language-switcher'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Rol } from '@shared/schema'

const ICONOS: Record<string, typeof FilePlus2> = {
  '/': FilePlus2,
  '/pedidos': ListChecks,
  '/surtir': PackageCheck,
  '/historial': History,
  '/pedidos-live': Radio,
  '/admin/usuarios': Users,
  '/admin/catalogo-onn': Tv,
  '/manual': BookOpen,
}

const LINKS: Record<Rol, { href: string; key: string }[]> = {
  admin: [
    { href: '/', key: 'nav.nuevoPedido' },
    { href: '/pedidos', key: 'nav.pedidos' },
    { href: '/surtir', key: 'nav.surtir' },
    { href: '/historial', key: 'nav.historial' },
    { href: '/pedidos-live', key: 'nav.pedidosEnVivo' },
    { href: '/admin/usuarios', key: 'nav.usuarios' },
    { href: '/admin/catalogo-onn', key: 'nav.catalogoOnn' },
    { href: '/manual', key: 'nav.manual' },
  ],
  capturista: [
    { href: '/', key: 'nav.nuevoPedido' },
    { href: '/pedidos', key: 'nav.pedidos' },
    { href: '/surtir', key: 'nav.surtir' },
    { href: '/manual', key: 'nav.manual' },
  ],
  surtidor: [
    { href: '/surtir', key: 'nav.surtir' },
    { href: '/manual', key: 'nav.manual' },
  ],
}

export default function Nav() {
  const { usuario, logout } = useAuth()
  const [location, setLocation] = useLocation()
  const { t } = useTranslation()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (!usuario) return null
  if (location === '/login' || /\/imprimir$/.test(location)) return null

  const links = LINKS[usuario.rol] || []
  const inicial = usuario.nombre?.trim()?.[0]?.toUpperCase() || '?'

  const salir = async () => {
    await logout()
    setLocation('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <nav className="flex h-[78px] w-full items-center gap-3 px-7">
        <Link href={usuario.rol === 'surtidor' ? '/surtir' : '/'}>
          <a className="flex shrink-0 items-center gap-2.5">
            <img src="/mitech-logo.png" alt="MiTech" className="h-9 w-9 rounded object-contain" />
            <span className="whitespace-nowrap text-[20px] font-bold text-foreground">{t('app.nombre')}</span>
          </a>
        </Link>

        {/* Links de escritorio — usan todo el espacio central, repartidos parejo */}
        <div className="hidden min-w-0 flex-1 items-stretch justify-evenly gap-1.5 overflow-hidden navlg:flex">
          {links.map((l) => {
            const Icono = ICONOS[l.href]
            const activo = location === l.href
            return (
              <Link key={l.href} href={l.href}>
                <a
                  className={`flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ${
                    activo
                      ? 'border-primary/30 bg-blue-50 text-primary shadow-sm shadow-primary/10'
                      : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {Icono && <Icono className="h-4 w-4 shrink-0" />}
                  {t(l.key)}
                </a>
              </Link>
            )
          })}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-3 navlg:flex">
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-primary">
                  {inicial}
                </span>
                <span className="whitespace-nowrap">
                  {usuario.nombre} · {t(`roles.${usuario.rol}`, ROL_LABEL[usuario.rol])}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={salir} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                {t('nav.salir')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Botón hamburguesa — solo por debajo de navlg (~1180px) */}
        <button
          type="button"
          className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground navlg:hidden"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label={menuAbierto ? t('nav.salir') : t('app.nombre')}
        >
          {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Menú desplegable móvil/tablet */}
      {menuAbierto && (
        <div className="border-t bg-card px-4 pb-3 pt-2 navlg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => {
              const Icono = ICONOS[l.href]
              const activo = location === l.href
              return (
                <Link key={l.href} href={l.href}>
                  <a
                    className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                      activo ? 'border-primary bg-blue-50 text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                    onClick={() => setMenuAbierto(false)}
                  >
                    {Icono && <Icono className="h-4 w-4 shrink-0" />}
                    {t(l.key)}
                  </a>
                </Link>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            <LanguageSwitcher />
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-primary">
                {inicial}
              </span>
              {usuario.nombre} · {t(`roles.${usuario.rol}`, ROL_LABEL[usuario.rol])}
            </span>
          </div>
          <Button size="sm" variant="outline" className="mt-3 w-full gap-1.5" onClick={salir}>
            <LogOut className="h-3.5 w-3.5" />
            {t('nav.salir')}
          </Button>
        </div>
      )}
    </header>
  )
}
