import './globals.css'
import { Inter } from 'next/font/google'
import AppShell from './components/app-shell'
import AutoRefresh from './components/auto-refresh'
import ChangelogModal from './components/changelog-modal'
import I18nProvider from './components/i18n-provider'
import AvisoSinAcceso from './components/aviso-sin-acceso'
import { getUsuario } from '@/lib/auth'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  title: 'MiTech — Pedidos TV',
  description: 'Captura e impresión de pedidos de televisiones',
  icons: {
    icon: '/mitech-icon.png',
  },
}

// Se aplica el tema guardado (o el del sistema si no hay preferencia) ANTES
// del primer paint, para que la página no parpadee en claro y luego salte a
// oscuro al hidratar. Ver [data-theme="dark"] en globals.css.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var guardado = localStorage.getItem('mitech-theme');
    var oscuro = guardado === 'dark' || (guardado !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (oscuro) document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
`

export default async function RootLayout({ children }) {
  const usuario = await getUsuario()

  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>
          <AppShell
            rol={usuario?.rol || null}
            email={usuario?.email || null}
            nombre={usuario?.nombre || null}
            allowedModules={usuario?.allowedModules || null}
          >
            <AvisoSinAcceso />
            <AutoRefresh />
            <ChangelogModal rol={usuario?.rol || null} />
            {children}
          </AppShell>
        </I18nProvider>
      </body>
    </html>
  )
}
