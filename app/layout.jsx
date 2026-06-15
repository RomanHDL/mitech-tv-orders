import './globals.css'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import Nav from './components/nav'
import AutoRefresh from './components/auto-refresh'

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
  const cookieStore = await cookies()
  const rol = cookieStore.get('rol')?.value || null
  const email = cookieStore.get('email')?.value || null
  const nombre = cookieStore.get('nombre')?.value || null

  return (
    <html lang="es" className={inter.variable}>
      <body>
        <Nav rol={rol} email={email} nombre={nombre} />
        <AutoRefresh />
        {children}
      </body>
    </html>
  )
}
