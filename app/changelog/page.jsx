import { getDb } from '@/lib/mongodb'
import { CATEGORIA_LABEL, PRIORIDAD_LABEL } from '@/lib/changelog'
import { IconDocument } from '../components/icons'

export const dynamic = 'force-dynamic'

async function obtenerEntradas() {
  const db = await getDb()
  const entradas = await db.collection('changelog_entries').find({}).sort({ publicadoEn: -1 }).toArray()
  const fmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
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
  const entradas = await obtenerEntradas()

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="font-display">Changelog</h1>
        <p className="subtitle">
          {entradas.length === 0
            ? 'Aún no hay entradas publicadas.'
            : `${entradas.length} ${entradas.length === 1 ? 'versión publicada' : 'versiones publicadas'}`}
        </p>
      </div>

      {entradas.length === 0 ? (
        <div className="card">
          <div className="empty">
            <IconDocument />
            <h3>Sin entradas todavía</h3>
            <p>Cuando se publique una nueva versión, aparecerá aquí.</p>
          </div>
        </div>
      ) : (
        <div className="changelog-lista">
          {entradas.map((e) => (
            <div key={e.id} className="card changelog-entrada">
              <div className="changelog-entrada-header">
                <span className="changelog-version">v{e.version}</span>
                <span className={`tag tag-cat-${e.categoria}`}>{CATEGORIA_LABEL[e.categoria]}</span>
                <span className={`tag tag-pri-${e.prioridad}`}>{PRIORIDAD_LABEL[e.prioridad]}</span>
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
