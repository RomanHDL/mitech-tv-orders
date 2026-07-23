import Link from 'next/link'
import { IconSearch } from './components/icons'
import { getServerT } from '@/lib/i18n-server'

export default async function NotFound() {
  const t = await getServerT()
  return (
    <main className="centro-mensaje">
      <div className="centro-mensaje-icon">
        <IconSearch width={28} height={28} />
      </div>
      <h1>{t('notFound.titulo')}</h1>
      <p>{t('notFound.texto')}</p>
      <Link href="/" className="btn btn-primary">{t('notFound.volverInicio')}</Link>
    </main>
  )
}
