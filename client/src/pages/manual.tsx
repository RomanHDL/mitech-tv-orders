// User Manual (gate #11) — categorías jerárquicas, páginas bilingües
// (se muestra ES o EN según el idioma actual de la app; zh-CN cae a ES,
// ver CLAUDE.md), búsqueda, permisos por rol (server ya filtra por
// rolMinimo en GET /api/documentation/categories).
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/queryClient'
import type { DocumentationCategory, DocumentationPage } from '@shared/schema'

type CategoriaConPaginas = DocumentationCategory & { paginas: Pick<DocumentationPage, 'id' | 'slug' | 'tituloEs' | 'tituloEn'>[] }
type ResultadoBusqueda = { catSlug: string; pageSlug: string; tituloEs: string; tituloEn: string }

export default function Manual() {
  const { i18n, t } = useTranslation()
  const esIngles = i18n.resolvedLanguage === 'en'

  const { data: categorias = [] } = useQuery<CategoriaConPaginas[]>({ queryKey: ['/api/documentation/categories'] })
  const [seleccion, setSeleccion] = useState<{ cat: string; page: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])

  const activa = seleccion ? `${seleccion.cat}/${seleccion.page}` : null
  const { data: paginaActiva } = useQuery<{ categoria: DocumentationCategory; pagina: DocumentationPage }>({
    queryKey: [`/api/documentation/page/${seleccion?.cat}/${seleccion?.page}`],
    enabled: !!seleccion,
  })

  const primeraPagina = useMemo(() => {
    for (const c of categorias) if (c.paginas[0]) return { cat: c.slug, page: c.paginas[0].slug }
    return null
  }, [categorias])

  const paginaMostrada = seleccion || primeraPagina

  async function buscar(q: string) {
    setBusqueda(q)
    if (!q.trim()) return setResultados([])
    const res = await apiRequest('GET', `/api/documentation/search?q=${encodeURIComponent(q)}`)
    setResultados(await res.json())
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">{t('manual.titulo')}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busqueda} onChange={(e) => buscar(e.target.value)} placeholder={t('manual.buscar')} className="pl-9" />
          </div>

          {busqueda.trim() ? (
            <ul className="space-y-1">
              {resultados.length === 0 && <li className="text-sm text-muted-foreground">{t('manual.sinResultados')}</li>}
              {resultados.map((r) => (
                <li key={`${r.catSlug}/${r.pageSlug}`}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                    onClick={() => setSeleccion({ cat: r.catSlug, page: r.pageSlug })}
                  >
                    {esIngles ? r.tituloEn : r.tituloEs}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <nav className="space-y-3">
              {categorias.map((c) => (
                <div key={c.id}>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{esIngles ? c.nombreEn : c.nombreEs}</h3>
                  <ul className="space-y-0.5">
                    {c.paginas.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary ${activa === `${c.slug}/${p.slug}` ? 'bg-secondary font-semibold' : ''}`}
                          onClick={() => setSeleccion({ cat: c.slug, page: p.slug })}
                        >
                          {esIngles ? p.tituloEn : p.tituloEs}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </aside>

        <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          {!paginaMostrada ? (
            <p className="text-muted-foreground">{t('manual.sinPaginas')}</p>
          ) : !paginaActiva && !seleccion ? (
            <ManualPagina catSlug={paginaMostrada.cat} pageSlug={paginaMostrada.page} esIngles={esIngles} />
          ) : paginaActiva ? (
            <article className="prose prose-sm max-w-none">
              <h2 className="mb-2 text-xl font-bold">{esIngles ? paginaActiva.pagina.tituloEn : paginaActiva.pagina.tituloEs}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{esIngles ? paginaActiva.pagina.contenidoEn : paginaActiva.pagina.contenidoEs}</p>
            </article>
          ) : null}
        </div>
      </div>
    </main>
  )
}

// Carga la primera página por defecto sin necesitar un click previo.
function ManualPagina({ catSlug, pageSlug, esIngles }: { catSlug: string; pageSlug: string; esIngles: boolean }) {
  const { data } = useQuery<{ categoria: DocumentationCategory; pagina: DocumentationPage }>({
    queryKey: [`/api/documentation/page/${catSlug}/${pageSlug}`],
  })
  if (!data) return null
  return (
    <article className="prose prose-sm max-w-none">
      <h2 className="mb-2 text-xl font-bold">{esIngles ? data.pagina.tituloEn : data.pagina.tituloEs}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{esIngles ? data.pagina.contenidoEn : data.pagina.contenidoEs}</p>
    </article>
  )
}
