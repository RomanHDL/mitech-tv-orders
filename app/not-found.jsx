import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="centro-mensaje">
      <h1>Página no encontrada</h1>
      <p>El pedido o la página que buscas no existe.</p>
      <Link href="/" className="btn-enviar">Volver al inicio</Link>
    </main>
  )
}
