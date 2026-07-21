import './globals.css'
import { Inter } from 'next/font/google'
import Nav from './components/nav'
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

export default async function RootLayout({ children }) {
  const usuario = await getUsuario()

  return (
    <html lang="es" className={inter.variable}>
      <body>
        <I18nProvider>
          <Nav
            rol={usuario?.rol || null}
            email={usuario?.email || null}
            nombre={usuario?.nombre || null}
            allowedModules={usuario?.allowedModules || null}
          />
          <AvisoSinAcceso />
          <AutoRefresh />
          <ChangelogModal rol={usuario?.rol || null} />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
