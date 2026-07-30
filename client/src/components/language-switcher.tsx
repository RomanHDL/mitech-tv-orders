// Selector de idioma — HARD RULE del stack (en / es-MX / zh-CN), persistido
// en localStorage vía i18next-browser-languagedetector (ver client/src/i18n).
// Antes era un segmented-control con los 3 idiomas siempre visibles; ahora
// es un botón compacto ("ES ▾") que abre un DropdownMenu con las mismas 3
// opciones. Misma llamada i18n.changeLanguage de siempre.
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const IDIOMAS = [
  { code: 'es-MX', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'zh-CN', label: '中文' },
] as const

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const actual = IDIOMAS.find((idioma) => idioma.code === i18n.resolvedLanguage) ?? IDIOMAS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 items-center gap-1 rounded-lg border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          {actual.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {IDIOMAS.map((idioma) => (
          <DropdownMenuItem
            key={idioma.code}
            onClick={() => i18n.changeLanguage(idioma.code)}
            className={idioma.code === actual.code ? 'font-semibold text-primary' : ''}
          >
            {idioma.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
