import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted-foreground">{t('common.noEncontrado')}</p>
    </main>
  )
}
