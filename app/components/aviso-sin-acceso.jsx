'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconClose } from './icons'

// Middleware redirige con ?sinAcceso=1 cuando el usuario intenta entrar por
// URL a un módulo que no tiene permitido. Este banner muestra el aviso una
// sola vez y limpia el query param (para que no reaparezca al refrescar).
function AvisoSinAccesoInner() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('sinAcceso') !== '1') return
    setVisible(true)
    const params = new URLSearchParams(searchParams)
    params.delete('sinAcceso')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null

  return (
    <div className="aviso-sin-acceso" role="alert">
      <IconAlert />
      <span>{t('common.sinPermisoModulo')}</span>
      <button type="button" onClick={() => setVisible(false)} aria-label={t('common.cerrar')}>
        <IconClose />
      </button>
    </div>
  )
}

export default function AvisoSinAcceso() {
  return (
    <Suspense fallback={null}>
      <AvisoSinAccesoInner />
    </Suspense>
  )
}
