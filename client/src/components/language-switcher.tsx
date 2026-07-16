// Selector de idioma — HARD RULE del stack (en / es-MX / zh-CN), persistido
// en localStorage vía i18next-browser-languagedetector (ver client/src/i18n).
import { useTranslation } from 'react-i18next'

const IDIOMAS = [
  { code: 'es-MX', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'zh-CN', label: '中文' },
] as const

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-secondary p-0.5 text-xs">
      {IDIOMAS.map((idioma) => (
        <button
          key={idioma.code}
          type="button"
          onClick={() => i18n.changeLanguage(idioma.code)}
          className={`min-h-7 rounded-sm px-2 py-1 font-semibold transition-colors ${
            i18n.resolvedLanguage === idioma.code ? 'bg-card shadow-sm' : 'text-muted-foreground'
          }`}
          aria-pressed={i18n.resolvedLanguage === idioma.code}
        >
          {idioma.label}
        </button>
      ))}
    </div>
  )
}
