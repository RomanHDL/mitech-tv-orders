import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, ROL_LABEL } from '@/lib/auth'
import { estadoLabel } from '@/lib/catalogos'
import { calcularTotales, diasHastaLimite, normalizeOrderStatus } from '@/lib/estado-pedido'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe } from '@/lib/intl-format'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import { ordenarPorMarcaYPulgadas } from '@/lib/orden-televisiones'
import {
  IconBox, IconCalendar, IconCheck, IconClipboardList, IconClock, IconUser,
} from '../../../components/icons'
import PrintButton from './print-button'
import PrintPageCount from './print-page-count'
import './imprimir.css'

async function obtenerPedido(id) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDb()
  return db.collection('pedidos').findOne({ _id: new ObjectId(id) })
}

function formatearFechaLimite(iso, lang) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// Igual que en la lista/historial: los estados finales (Cargando, Listo para
// salida, Despachado, Cancelado, Surtido terminado) nunca deben mostrar
// "Vencido" — el pedido ya avanzó, la fecha límite dejó de importar.
function tiempoRestante(t, estado, dias, pendiente) {
  if (estado === 'DESPACHADO') return { texto: estadoLabel(t, 'DESPACHADO').toUpperCase(), tono: 'verde' }
  if (estado === 'LISTO_SALIDA') return { texto: estadoLabel(t, 'LISTO_SALIDA').toUpperCase(), tono: 'verde' }
  if (estado === 'CARGANDO') return { texto: estadoLabel(t, 'CARGANDO').toUpperCase(), tono: 'amarillo' }
  if (estado === 'TERMINADO') return { texto: estadoLabel(t, 'TERMINADO').toUpperCase(), tono: 'verde' }
  if (estado === 'CANCELADO') return { texto: estadoLabel(t, 'CANCELADO').toUpperCase(), tono: 'rojo' }

  if (dias === null) return null
  if (dias < 0 && pendiente > 0) return { texto: t('imprimir.vencidoHace', { count: Math.abs(dias) }), tono: 'rojo' }
  if (dias < 0) return null
  if (dias === 0) return { texto: t('imprimir.entregaHoy'), tono: 'rojo' }
  if (dias === 1) return { texto: t('imprimir.entregaManana'), tono: 'amarillo' }
  if (dias <= 3) return { texto: t('imprimir.diasFaltantes', { count: dias }), tono: 'amarillo' }
  return { texto: t('imprimir.diasFaltantes', { count: dias }), tono: 'verde' }
}

// Avance real de UNA partida (SKU) — misma fórmula que calcularTotales() a
// nivel de pedido, aplicada por renglón. "Sin límite" no tiene techo contra
// el cual medir avance/pendiente: se muestra aparte (S/L), no se fuerza a
// un porcentaje inventado. Coincide con el criterio ya usado en
// pedido-detalle-modal.jsx (estadoPartida) para no divergir del resto de
// la app en ese caso particular.
function calcularAvanceSku(tv) {
  const surtidaCruda = tv.cantidadSurtida || 0

  if (tv.sinLimite) {
    return {
      solicitada: null,
      surtida: surtidaCruda,
      pendiente: null,
      avancePct: null,
      estado: surtidaCruda > 0 ? 'PARCIAL' : 'PENDIENTE',
    }
  }

  const solicitada = tv.cantidad || 0
  const surtida = Math.min(solicitada, surtidaCruda)
  const pendiente = Math.max(0, solicitada - surtida)
  const avancePct = solicitada > 0 ? Math.round((surtida / solicitada) * 100) : 0

  let estado
  if (solicitada === 0) estado = 'SIN_SOLICITUD'
  else if (surtida >= solicitada) estado = 'COMPLETO'
  else if (surtida > 0) estado = 'PARCIAL'
  else estado = 'PENDIENTE'

  return { solicitada, surtida, pendiente, avancePct, estado }
}

const ESTADO_SKU_CLASE = {
  COMPLETO: 'completo',
  PARCIAL: 'parcial',
  PENDIENTE: 'pendiente',
  SIN_SOLICITUD: 'sin-solicitud',
}

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()
  const t = await getServerT()
  const lang = await getServerLang()
  const usuario = await getUsuario()

  // Mismo orden "canónico" que ya usa el módulo Surtir (agrupado por marca,
  // ordenado por pulgadas dentro de cada marca) — ver lib/orden-televisiones.js.
  // Antes esta tabla usaba el orden crudo del arreglo guardado, que dejaba
  // los SKUs agregados después (ej. "agregar SKU de último momento") pegados
  // al final en vez de junto a sus hermanos del mismo tamaño.
  const televisiones = ordenarPorMarcaYPulgadas(pedido.televisiones || []).map((tvRaw) => ({
    ...tvRaw,
    condiciones: Array.isArray(tvRaw.condiciones) ? tvRaw.condiciones : (tvRaw.condicion ? [tvRaw.condicion] : []),
  }))

  const filasSku = televisiones.map((tv) => ({ tv, avance: calcularAvanceSku(tv) }))
  const marcasDistintas = [...new Set(televisiones.map((tv) => tv.marca).filter(Boolean))].sort()

  const { totalRequerido, totalSurtido, progresoPct, pendiente } = calcularTotales(pedido)

  const fechaFmt = new Date(pedido.fecha).toLocaleDateString(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const fechaLimiteFmt = formatearFechaLimite(pedido.fechaLimite, lang)
  const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: pedido.estadoOperativo || null })
  const dias = diasHastaLimite(pedido.fechaLimite)
  const tiempo = tiempoRestante(t, estado, dias, pendiente)
  const generadoFmt = new Date().toLocaleString(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const generadoPorNombre = usuario?.nombre
    ? `${usuario.nombre}${usuario.rol ? ` (${ROL_LABEL[usuario.rol] || usuario.rol})` : ''}`
    : (pedido.creadoPorNombre || '—')
  const pedidoRef = String(pedido._id).slice(-6).toUpperCase()

  return (
    <main className="imprimir-shell">
      <PrintButton />
      <div id="print-order-root" className="print-hoja">
        {/* 1) Encabezado superior */}
        <div className="print-brand-row">
          <div className="print-brand">
            <img src={LOGO_MITECH} alt="MiTechnologies" className="print-brand-logo" />
          </div>
          <div className="print-ref">REF: {pedidoRef}</div>
        </div>

        <div className="print-title-row">
          <h1 className="print-pedido-nombre">{pedido.pedidoNombre.toUpperCase()}</h1>
          {pedido.numeroPedido && (
            <div className="print-numero-box">
              <div className="print-numero-label">{t('imprimir.numeroPedidoLabel')}</div>
              <div className="print-numero-valor">{pedido.numeroPedido}</div>
            </div>
          )}
        </div>

        {/* 2) Información general */}
        <div className="print-info-grid">
          <div className="print-info-cell">
            <IconCalendar />
            <div>
              <div className="print-info-label">{t('pedidos.colFechaCreacion')}</div>
              <div className="print-info-value">{fechaFmt}</div>
            </div>
          </div>
          {fechaLimiteFmt && (
            <div className="print-info-cell">
              <IconCalendar />
              <div>
                <div className="print-info-label">{t('pedidoForm.fechaLimite')}</div>
                <div className="print-info-value">{fechaLimiteFmt}</div>
              </div>
            </div>
          )}
          <div className="print-info-cell">
            <IconClock />
            <div>
              <div className="print-info-label">{t('imprimir.tiempoRestante')}</div>
              {tiempo ? (
                <span className={`print-tiempo-pill tono-${tiempo.tono}`}>{tiempo.texto}</span>
              ) : (
                <div className="print-info-value">—</div>
              )}
            </div>
          </div>
          <div className="print-info-cell">
            <IconUser />
            <div>
              <div className="print-info-label">{t('imprimir.capturo')}</div>
              <div className="print-info-value">{pedido.creadoPorNombre || '—'}</div>
            </div>
          </div>
        </div>

        {pedido.condiciones?.length > 0 && (
          <div className="print-condiciones">
            <span className="print-condiciones-label">{t('imprimir.condicionesLabel')}:</span>
            {pedido.condiciones.map((c) => (
              <span key={c} className={`condicion-chip cond-${c.toLowerCase()}`}>{c}</span>
            ))}
          </div>
        )}

        {typeof pedido.comentarios === 'string' && pedido.comentarios.trim() && (
          <div className="print-comentarios">
            <span className="print-comentarios-label">{t('imprimir.comentariosLabel')}</span>
            <p className="print-comentarios-texto">{pedido.comentarios}</p>
          </div>
        )}

        {/* 3) Avance general del pedido */}
        <h2 className="print-section-title">{t('imprimir.avanceGeneralTitulo')}</h2>

        <div className="print-kpi-grid">
          <div className="print-kpi-card">
            <span className="print-kpi-icon"><IconBox /></span>
            <div>
              <div className="print-kpi-valor">{televisiones.length}</div>
              <div className="print-kpi-label">{t('imprimir.totalSku')}</div>
            </div>
          </div>
          <div className="print-kpi-card">
            <span className="print-kpi-icon"><IconCheck /></span>
            <div>
              <div className="print-kpi-valor">{totalSurtido}</div>
              <div className="print-kpi-label">{t('imprimir.totalSurtida')}</div>
            </div>
          </div>
          <div className="print-kpi-card">
            <span className="print-kpi-icon"><IconClipboardList /></span>
            <div>
              <div className="print-kpi-valor">{totalRequerido}</div>
              <div className="print-kpi-label">{t('imprimir.totalSolicitada')}</div>
            </div>
          </div>
          <div className="print-kpi-card">
            <span className="print-kpi-icon"><IconClock /></span>
            <div>
              <div className="print-kpi-valor">{pendiente}</div>
              <div className="print-kpi-label">{t('imprimir.totalPendiente')}</div>
            </div>
          </div>
        </div>

        <div className="print-progreso">
          <div className="print-progreso-header">
            <span className="print-progreso-titulo">{t('imprimir.progresoPedido')}</span>
            <span className="print-progreso-pct">{progresoPct}%</span>
          </div>
          <div className="print-progreso-track">
            <div className="print-progreso-fill" style={{ width: `${Math.min(100, progresoPct)}%` }} />
          </div>
          <div className="print-progreso-texto">
            {t('imprimir.articulosSurtidos', { surtidos: totalSurtido, total: totalRequerido })}
            {' · '}
            {t('imprimir.pendientesCount', { count: pendiente })}
          </div>
        </div>

        {/* 4) Avance por SKU */}
        <h2 className="print-section-title">{t('imprimir.avancePorSkuTitulo')}</h2>
        <p className="print-section-subtitulo">{t('imprimir.avancePorSkuSubtitulo')}</p>

        <table className="print-sku-table">
          <thead>
            <tr>
              <th>{t('imprimir.colSku')}</th>
              <th>{t('common.marca')}</th>
              <th>{t('common.pulgadas')}</th>
              <th>{t('imprimir.colCondicion')}</th>
              <th className="num">{t('imprimir.colSolicitada')}</th>
              <th className="num">{t('imprimir.colSurtida')}</th>
              <th className="num">{t('common.pendiente')}</th>
              <th>{t('imprimir.colAvance')}</th>
              <th>{t('imprimir.colEstado')}</th>
            </tr>
          </thead>
          <tbody>
            {filasSku.map(({ tv, avance }, i) => (
              <tr key={i}>
                <td className="print-sku-nombre">
                  {tv.marca} {tv.pulgadas}″ {tv.modelo || '—'}
                </td>
                <td>{tv.marca || '—'}</td>
                <td>{tv.pulgadas ? `${tv.pulgadas}″` : '—'}</td>
                <td>
                  <span className="print-cond-mini">
                    {(tv.condiciones || []).map((c) => (
                      <span key={c} className={`print-cond-chip cond-${c.toLowerCase()}`}>{c}</span>
                    ))}
                  </span>
                </td>
                <td className="num">{tv.sinLimite ? t('pedidoForm.sinLimite') : avance.solicitada}</td>
                <td className="num">{avance.surtida}</td>
                <td className="num">{tv.sinLimite ? '—' : avance.pendiente}</td>
                <td>
                  {tv.sinLimite ? (
                    <span className="print-avance-sinlimite">{t('imprimir.sinLimiteAbrev')}</span>
                  ) : (
                    <div className="print-avance-celda">
                      <div className="print-avance-track">
                        <div className="print-avance-fill" style={{ width: `${avance.avancePct}%` }} />
                      </div>
                      <span className="print-avance-pct">{avance.avancePct}%</span>
                    </div>
                  )}
                </td>
                <td>
                  <span className={`print-estado-badge ${ESTADO_SKU_CLASE[avance.estado]}`}>
                    {avance.estado === 'SIN_SOLICITUD' ? t('imprimir.sinSolicitud') : t(`common.${ESTADO_SKU_CLASE[avance.estado]}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5) Resumen inferior */}
        <div className="print-resumen-final">
          <div className="print-resumen-card">
            <span className="print-resumen-icon"><IconClipboardList /></span>
            <div>
              <div className="print-resumen-valor">{totalRequerido}</div>
              <div className="print-resumen-label">{t('imprimir.totalSolicitada')}</div>
            </div>
          </div>
          <div className="print-resumen-card">
            <span className="print-resumen-icon"><IconCheck /></span>
            <div>
              <div className="print-resumen-valor">{totalSurtido}</div>
              <div className="print-resumen-label">{t('imprimir.totalSurtida')}</div>
            </div>
          </div>
          <div className="print-resumen-card">
            <span className="print-resumen-icon"><IconClock /></span>
            <div>
              <div className="print-resumen-valor">{pendiente}</div>
              <div className="print-resumen-label">{t('common.pendiente')}</div>
            </div>
          </div>
          <div className="print-resumen-card">
            <span className="print-resumen-icon"><IconBox /></span>
            <div>
              <div className="print-resumen-valor">{televisiones.length}</div>
              <div className="print-resumen-label">{t('imprimir.skuDiferentes')}</div>
            </div>
          </div>
          <div className="print-resumen-card">
            <span className="print-resumen-icon"><IconClipboardList /></span>
            <div>
              <div className="print-resumen-valor">{marcasDistintas.length}</div>
              <div className="print-resumen-label">{marcasDistintas.length === 1 ? t('common.marca') : t('pedidoForm.marcas')}</div>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <footer className="print-footer">
          <span>
            {t('imprimir.generadoPrefijo', { fecha: generadoFmt })} · {t('imprimir.generadoPor')}: {generadoPorNombre}
          </span>
          <PrintPageCount />
        </footer>
      </div>
    </main>
  )
}
