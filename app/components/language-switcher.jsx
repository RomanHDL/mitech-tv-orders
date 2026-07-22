'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const IDIOMAS = [
  { code: 'es-MX', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'zh-CN', label: '中文' },
]

// La detección de idioma (i18next-browser-languagedetector) solo guarda en
// localStorage, que el servidor no puede leer. Se refleja el mismo valor en
// una cookie (mitech_idioma) para que los Server Components/Route Handlers
// puedan traducir contenido que se genera en el servidor (ver
// lib/i18n-server.js) — impresión, exportaciones, páginas sin client wrapper.
function sincronizarCookieIdioma(lang) {
  document.cookie = `mitech_idioma=${lang}; path=/; max-age=31536000; samesite=lax`
}

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation()

  useEffect(() => {
    if (i18n.language) sincronizarCookieIdioma(i18n.language)
  }, [i18n.language])

  return (
    <select
      className={`language-switcher ${className}`}
      value={i18n.language && IDIOMAS.some((l) => l.code === i18n.language) ? i18n.language : 'es-MX'}
      onChange={(e) => {
        i18n.changeLanguage(e.target.value)
        sincronizarCookieIdioma(e.target.value)
      }}
      aria-label="Idioma / Language / 语言"
    >
      {IDIOMAS.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  )
}
