// "What's new" modal (gate #12) — se muestra una sola vez por versión no
// descartada por el usuario actual. Se monta globalmente en App.tsx dentro
// de <AuthProvider>, solo pinta algo cuando hay sesión y una entrada
// pendiente.
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import type { ChangelogEntry, ChangelogItem } from '@shared/schema'

type EntryConItems = ChangelogEntry & { items: ChangelogItem[] }

export default function ChangelogModal() {
  const { usuario } = useAuth()
  const { i18n, t } = useTranslation()
  const esIngles = i18n.resolvedLanguage === 'en'
  const queryClient = useQueryClient()

  const { data: entrada } = useQuery<EntryConItems | null>({
    queryKey: ['/api/changelog/latest'],
    enabled: !!usuario,
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/changelog/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/changelog/latest'] }),
  })

  if (!usuario || !entrada) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase text-muted-foreground">{t('changelog.novedades')} · v{entrada.version}</span>
            <h2 className="text-lg font-bold">{esIngles ? entrada.tituloEn : entrada.tituloEs}</h2>
          </div>
          <button type="button" onClick={() => dismissMutation.mutate(entrada.id)} aria-label={t('common.cerrar')} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {entrada.items.length > 0 && (
          <ul className="mb-4 list-inside list-disc space-y-1 text-sm">
            {entrada.items.map((it) => (
              <li key={it.id}>{esIngles ? it.textoEn : it.textoEs}</li>
            ))}
          </ul>
        )}
        <Button className="w-full" onClick={() => dismissMutation.mutate(entrada.id)} disabled={dismissMutation.isPending}>
          {t('changelog.entendido')}
        </Button>
      </div>
    </div>
  )
}
