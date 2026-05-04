import './globals.css'
import Nav from './components/nav'

export const metadata = {
  title: 'MiTech — Pedidos TV',
  description: 'Captura e impresión de pedidos de televisiones',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
