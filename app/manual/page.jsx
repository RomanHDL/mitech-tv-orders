import ManualCliente from './manual-cliente'
import { getServerT } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export default async function ManualPage() {
  const t = await getServerT()
  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('manual.titulo')}</h1>
        <p className="subtitle">{t('manual.subtitulo')}</p>
      </div>
      <ManualCliente />
    </main>
  )
}
