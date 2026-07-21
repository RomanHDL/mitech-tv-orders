import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { construirFiltroEventos, idsDePedidosDeCapturista } from '@/lib/eventos'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import PrintButtonPdf from './print-button-pdf'
import './exportar-pdf.css'

export const dynamic = 'force-dynamic'

const LIMITE_REPORTE = 2000

const ESTADO_LABEL_LOCAL = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', TERMINADO: 'Surtido terminado',
  CARGANDO: 'Cargando', LISTO_SALIDA: 'Listo para salida', DESPACHADO: 'Despachado', CANCELADO: 'Cancelado',
}

function fmtFechaHora(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

const ETIQUETA_FILTRO = {
  estado: 'Estado', tipo: 'Tipo de evento', usuario: 'Usuario', condicion: 'Condición', categoria: 'Categoría',
}

// Reporte imprimible del historial — respeta exactamente los mismos filtros
// que la tabla (misma query string), sin paginar (tope duro de 2000 filas
// para que el reporte siga siendo legible/imprimible).
export default async function ExportarHistorialPdf({ searchParams }) {
  const sp = await searchParams
  const usuario = await getUsuario()
  const db = await getDb()

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

  const generadoFmt = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date())

  return (
    <main className="historial-pdf">
      <PrintButtonPdf />
      <div className="pdf-encabezado">
        <img src={LOGO_MITECH} alt="MiTechnologies" className="pdf-logo" />
        <div>
          <h1>Historial de pedidos — Reporte</h1>
          <p>Generado el {generadoFmt}</p>
        </div>
      </div>

      <div className="pdf-meta">
        <div><strong>Rango de fechas:</strong> {sp.desde || '—'} a {sp.hasta || '—'}</div>
        {sp.q && <div><strong>Búsqueda:</strong> "{sp.q}"</div>}
        {filtrosActivos.length > 0 && (
          <div>
            <strong>Filtros aplicados:</strong>{' '}
            {filtrosActivos.map(([k, v]) => `${ETIQUETA_FILTRO[k]}: ${v}`).join(' · ')}
          </div>
        )}
        <div><strong>Total de registros:</strong> {total.toLocaleString('es-MX')}{total > LIMITE_REPORTE ? ` (mostrando los primeros ${LIMITE_REPORTE})` : ''}</div>
      </div>

      <table className="pdf-tabla">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>N.º Pedido</th>
            <th>Pedido</th>
            <th>Evento</th>
            <th>Estado anterior</th>
            <th>Estado nuevo</th>
            <th>Usuario</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e._id.toString()}>
              <td>{fmtFechaHora(e.creadoEn)}</td>
              <td>{e.numeroPedido || '—'}</td>
              <td>{e.pedidoNombre || '—'}</td>
              <td>{e.detalle}</td>
              <td>{e.estadoAnterior ? (ESTADO_LABEL_LOCAL[e.estadoAnterior] || e.estadoAnterior) : '—'}</td>
              <td>{e.estadoNuevo ? (ESTADO_LABEL_LOCAL[e.estadoNuevo] || e.estadoNuevo) : '—'}</td>
              <td>{e.usuarioNombre || '—'}</td>
              <td>{e.detalle}{e.detalleSecundario ? ` — ${e.detalleSecundario}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {eventos.length === 0 && <p className="pdf-vacio">No se encontraron eventos con los filtros seleccionados.</p>}
    </main>
  )
}
