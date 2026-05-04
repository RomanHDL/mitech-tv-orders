import './globals.css'

export const metadata = {
  title: 'MiTech — Pedidos TV',
  description: 'Captura e impresión de pedidos de televisiones',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
