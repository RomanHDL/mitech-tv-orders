import { getDb } from '@/lib/mongodb'
import { categoriaLabel, prioridadLabel } from '@/lib/changelog'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe } from '@/lib/intl-format'
import { IconDocument } from '../components/icons'

export const dynamic = 'force-dynamic'

async function obtenerEntradas(lang) {
  const db = await getDb()
  const entradas = await db.collection('changelog_entries').find({}).sort({ publicadoEn: -1 }).toArray()
  const fmt = new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'long', year: 'numeric' })
  return entradas.map((e) => ({
    id: e._id.toString(),
    version: e.version,
    titulo: e.titulo,
    categoria: e.categoria,
    prioridad: e.prioridad,
    items: e.items || [],
    publicadoEnFmt: e.publicadoEn ? fmt.format(e.publicadoEn) : '',
  }))
}

export default async function ChangelogPage() {
  const t = await getServerT()
  const lang = await getServerLang()
  const entradas = await obtenerEntradas(lang)

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="font-display">{t('changelog.titulo')}</h1>
        <p className="subtitle">
          {entradas.length === 0
            ? t('changelog.sinEntradas')
            : t('changelog.versionesPublicadas', { count: entradas.length })}
        </p>
      </div>

      {entradas.length === 0 ? (
        <div className="card">
          <div className="empty">
            <IconDocument />
            <h3>{t('changelog.sinEntradasTitulo')}</h3>
            <p>{t('changelog.sinEntradasDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="changelog-lista">
          {entradas.map((e) => (
            <div key={e.id} className="card changelog-entrada">
              <div className="changelog-entrada-header">
                <span className="changelog-version">v{e.version}</span>
                <span className={`tag tag-cat-${e.categoria}`}>{categoriaLabel(t, e.categoria)}</span>
                <span className={`tag tag-pri-${e.prioridad}`}>{prioridadLabel(t, e.prioridad)}</span>
                <span className="changelog-fecha">{e.publicadoEnFmt}</span>
              </div>
              <h3 className="changelog-titulo">{e.titulo}</h3>
              {e.items.length > 0 && (
                <ul className="changelog-items">
                  {e.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
