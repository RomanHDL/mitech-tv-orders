import AdminChangelogCliente from './admin-changelog-cliente'

export const dynamic = 'force-dynamic'

export default function AdminChangelogPage() {
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>Changelog</h1>
        <p className="subtitle">Publica o elimina entradas de versión visibles en /changelog.</p>
      </div>
      <AdminChangelogCliente />
    </main>
  )
}
