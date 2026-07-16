// Historial completo del changelog (gate #12) — GET /api/changelog/all.
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { ChangelogEntry, ChangelogItem } from '@shared/schema'

type EntryConItems = ChangelogEntry & { items: ChangelogItem[] }

const COLOR_CATEGORIA: Record<string, string> = {
  feature: 'bg-primary/15 text-primary',
  improvement: 'bg-accent/30',
  bugfix: 'bg-yellow-100 text-yellow-800',
  security: 'bg-destructive/15 text-destructive',
}

export default function Changelog() {
  const { i18n, t } = useTranslation()
  const esIngles = i18n.resolvedLanguage === 'en'
  const { data: entradas = [], isLoading } = useQuery<EntryConItems[]>({ queryKey: ['/api/changelog/all'] })

  if (isLoading) return null

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">{t('changelog.titulo')}</h1>
      </div>

      <div className="space-y-4">
        {entradas.map((e) => (
          <div key={e.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">v{e.version}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_CATEGORIA[e.categoria] || 'bg-secondary'}`}>{e.categoria}</span>
              <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(esIngles ? 'en-US' : 'es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(e.publicadoEn))}</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold">{esIngles ? e.tituloEn : e.tituloEs}</h2>
            {e.items.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {e.items.map((it) => (
                  <li key={it.id}>{esIngles ? it.textoEn : it.textoEs}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
