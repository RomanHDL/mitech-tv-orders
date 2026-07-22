import AdminManualCliente from './admin-manual-cliente'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export default async function AdminManualPage() {
  const t = await getServerT()
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('manualAdmin.titulo')}</h1>
        <p className="subtitle">{t('manualAdmin.subtitulo')}</p>
      </div>
      <AdminManualCliente />
    </main>
  )
}
