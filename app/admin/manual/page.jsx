import AdminManualCliente from './admin-manual-cliente'

export const dynamic = 'force-dynamic'

export default function AdminManualPage() {
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Editar Manual</h1>
        <p className="subtitle">Administra las categorías y páginas visibles en /manual.</p>
      </div>
      <AdminManualCliente />
    </main>
  )
}
