'use client'

import { useTranslation } from 'react-i18next'

const IDIOMAS = [
  { code: 'es-MX', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'zh-CN', label: '中文' },
]

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation()

  return (
    <select
      className={`language-switcher ${className}`}
      value={i18n.language && IDIOMAS.some((l) => l.code === i18n.language) ? i18n.language : 'es-MX'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label="Idioma / Language / 语言"
    >
      {IDIOMAS.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  )
}
