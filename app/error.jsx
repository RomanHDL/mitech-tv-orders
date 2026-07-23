'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlert } from './components/icons'

export default function Error({ error, reset }) {
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="centro-mensaje">
      <div className="centro-mensaje-icon">
        <IconAlert width={28} height={28} />
      </div>
      <h1>{t('errorPage.titulo')}</h1>
      <p>{error?.message || t('errorPage.texto')}</p>
      <button onClick={reset} className="btn btn-primary">{t('common.reintentar')}</button>
    </main>
  )
}
