import AdminChangelogCliente from './admin-changelog-cliente'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export default async function AdminChangelogPage() {
  const t = await getServerT()
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('changelog.titulo')}</h1>
        <p className="subtitle">{t('changelogAdmin.subtitulo')}</p>
      </div>
      <AdminChangelogCliente />
    </main>
  )
}
