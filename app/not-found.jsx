import Link from 'next/link'
import { IconSearch } from './components/icons'

export default function NotFound() {
  return (
    <main className="centro-mensaje">
      <div className="centro-mensaje-icon">
        <IconSearch width={28} height={28} />
      </div>
      <h1>No encontrado</h1>
      <p>El pedido o la página que buscas no existe.</p>
      <Link href="/" className="btn btn-primary">Volver al inicio</Link>
    </main>
  )
}
