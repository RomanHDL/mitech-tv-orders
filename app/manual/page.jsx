import ManualCliente from './manual-cliente'

export const dynamic = 'force-dynamic'

export default function ManualPage() {
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Manual</h1>
        <p className="subtitle">Guías de uso de la aplicación.</p>
      </div>
      <ManualCliente />
    </main>
  )
}
