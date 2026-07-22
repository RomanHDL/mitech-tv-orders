import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { construirFiltroEventos, idsDePedidosDeCapturista } from '@/lib/eventos'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import { estadoLabel } from '@/lib/catalogos'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe, formatearNumero } from '@/lib/intl-format'
import PrintButtonPdf from './print-button-pdf'
import './exportar-pdf.css'

export const dynamic = 'force-dynamic'

const LIMITE_REPORTE = 2000

function fmtFechaHora(iso, lang) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

// Reporte imprimible del historial — respeta exactamente los mismos filtros
// que la tabla (misma query string), sin paginar (tope duro de 2000 filas
// para que el reporte siga siendo legible/imprimible).
export default async function ExportarHistorialPdf({ searchParams }) {
  const sp = await searchParams
  const usuario = await getUsuario()
  const db = await getDb()
  const t = await getServerT()
  const lang = await getServerLang()
  const ETIQUETA_FILTRO = {
    estado: t('historial.estado'), tipo: t('historial.tipoEvento'), usuario: t('historial.usuario'),
    condicion: t('historial.condicion'), categoria: t('historial.categoria'),
  }

  const filtro = construirFiltroEventos({
    busqueda: sp.q || '',
    desde: sp.desde || '',
    hasta: sp.hasta || '',
    estado: sp.estado || 'todos',
    tipoEvento: sp.tipo || 'todos',
    usuarioId: sp.usuario || 'todos',
    condicion: sp.condicion || 'todos',
    categoria: sp.categoria || 'todos',
    pedidoIdsDeCapturista: await idsDePedidosDeCapturista(db, usuario),
  })

  const [eventos, total] = await Promise.all([
    db.collection('eventos').find(filtro).sort({ creadoEn: -1 }).limit(LIMITE_REPORTE).toArray(),
    db.collection('eventos').countDocuments(filtro),
  ])

  const filtrosActivos = Object.entries({
    estado: sp.estado, tipo: sp.tipo, usuario: sp.usuario, condicion: sp.condicion, categoria: sp.categoria,
  }).filter(([, v]) => v && v !== 'todos')

  const generadoFmt = new Intl.DateTimeFormat(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date())

  return (
    <main className="historial-pdf">
      <PrintButtonPdf />
      <div className="pdf-encabezado">
        <img src={LOGO_MITECH} alt="MiTechnologies" className="pdf-logo" />
        <div>
          <h1>{t('historial.reporteTitulo')}</h1>
          <p>{t('historial.generadoEl', { fecha: generadoFmt })}</p>
        </div>
      </div>

      <div className="pdf-meta">
        <div><strong>{t('historial.rangoFechas')}</strong> {sp.desde || '—'} a {sp.hasta || '—'}</div>
        {sp.q && <div><strong>{t('historial.busqueda')}</strong> "{sp.q}"</div>}
        {filtrosActivos.length > 0 && (
          <div>
            <strong>{t('historial.filtrosAplicados')}</strong>{' '}
            {filtrosActivos.map(([k, v]) => `${ETIQUETA_FILTRO[k]}: ${v}`).join(' · ')}
          </div>
        )}
        <div><strong>{t('historial.totalRegistros')}</strong> {formatearNumero(total, lang)}{total > LIMITE_REPORTE ? t('historial.mostrandoPrimeros', { n: LIMITE_REPORTE }) : ''}</div>
      </div>

      <table className="pdf-tabla">
        <thead>
          <tr>
            <th>{t('historial.colFechaHora')}</th>
            <th>{t('historial.colNumeroPedido')}</th>
            <th>{t('historial.colPedido')}</th>
            <th>{t('historial.colEvento')}</th>
            <th>{t('historial.colEstadoAnterior')}</th>
            <th>{t('historial.colEstadoNuevo')}</th>
            <th>{t('historial.colUsuario')}</th>
            <th>{t('historial.colDetalle')}</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e._id.toString()}>
              <td>{fmtFechaHora(e.creadoEn, lang)}</td>
              <td>{e.numeroPedido || '—'}</td>
              <td>{e.pedidoNombre || '—'}</td>
              <td>{e.detalle}</td>
              <td>{e.estadoAnterior ? estadoLabel(t, e.estadoAnterior) : '—'}</td>
              <td>{e.estadoNuevo ? estadoLabel(t, e.estadoNuevo) : '—'}</td>
              <td>{e.usuarioNombre || '—'}</td>
              <td>{e.detalle}{e.detalleSecundario ? ` — ${e.detalleSecundario}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {eventos.length === 0 && <p className="pdf-vacio">{t('historial.sinEventosReporte')}</p>}
    </main>
  )
}
