import { getServerT } from '@/lib/i18n-server'

export default async function Loading() {
  const t = await getServerT()
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <div>{t('common.cargando')}</div>
    </div>
  )
}
