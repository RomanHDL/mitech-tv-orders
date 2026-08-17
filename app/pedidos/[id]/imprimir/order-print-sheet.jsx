import { estadoLabel } from '@/lib/catalogos'
import { GROUP_STATUS, calculateBrandSummary } from '@/lib/surtido-grupos'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import {
  IconBox, IconCalendar, IconCheck, IconClipboardList, IconClock, IconUser,
} from '../../../components/icons'
import PrintButton from './print-button'
import PrintPageCount from './print-page-count'
import './imprimir.css'

// Avance real de UNA partida (SKU) — la meta pertenece al GRUPO (marca +
// pulgadas), no a cada SKU individual: misma fuente de verdad que Surtir/
// Nuevo/Editar (lib/surtido-grupos.js), nunca metasGrupo hardcodeado aquí.
// Solo cuando el grupo tiene un único SKU con meta definida existe una meta
// "propia" de esa partida (getIndividualSkuTarget); si el grupo tiene varios
// SKU, la meta es compartida y no se le puede atribuir a ningún renglón en
// particular — se marca con "metaCompartida" en vez de repetir un número que
// no le pertenece a esa fila.
function calcularAvanceSku(tv, group) {
  const surtida = Number(tv.cantidadSurtida) || 0
  const individualTarget = group.summary.individualTarget

  if (individualTarget !== null && individualTarget !== undefined) {
    const solicitada = individualTarget
    const surtidaAcotada = Math.min(solicitada, surtida)
    const pendiente = Math.max(0, solicitada - surtida)
    const avancePct = solicitada > 0 ? Math.round((surtidaAcotada / solicitada) * 100) : 0

    let estado
    if (solicitada === 0) estado = 'SIN_SOLICITUD'
    else if (surtida >= solicitada) estado = 'COMPLETO'
    else if (surtida > 0) estado = 'PARCIAL'
    else estado = 'PENDIENTE'

    return { solicitada, surtida, pendiente, avancePct, metaCompartida: false, estado }
  }

  // Sin meta propia — dos motivos posibles, y el renglón debe distinguirlos:
  // (a) el grupo SÍ tiene meta pero la comparte entre varios SKU
  //     ("Meta compartida"), o
  // (b) el grupo todavía no tiene ninguna meta definida ("Por definir"),
  //     sin importar si tiene uno o varios SKU (ej. Samsung 85").
  // En ambos casos no hay número propio que mostrar, solo si el SKU ya
  // aportó algo (Parcial) o no (Pendiente) — nunca "Sin solicitud" (ese
  // texto queda solo para una meta explícita de 0, ver arriba).
  const metaDefinida = group.requested !== null && group.requested !== undefined
  return {
    solicitada: null,
    surtida,
    pendiente: null,
    avancePct: null,
    metaCompartida: metaDefinida && group.products.length > 1,
    estado: surtida > 0 ? 'PARCIAL' : 'PENDIENTE',
  }
}

const ESTADO_SKU_CLASE = {
  COMPLETO: 'completo',
  PARCIAL: 'parcial',
  PENDIENTE: 'pendiente',
  SIN_SOLICITUD: 'sin-solicitud',
}

// Etiqueta/clase del estado a nivel de GRUPO — solo para esta hoja impresa.
// Reutiliza los mismos GROUP_STATUS que Surtir, pero con vocabulario propio
// del reporte (p.ej. "Pendiente" en vez de "Sin iniciar", que es el término
// que sí usa la pantalla de Surtir) — nunca toca groupStatusLabel() ni las
// etiquetas que Surtir ya muestra en pantalla.
const GRUPO_ESTADO_INFO = {
  [GROUP_STATUS.COMPLETE]: { key: 'surtir.grupo.estadoCompleto', clase: 'completo' },
  [GROUP_STATUS.IN_PROGRESS]: { key: 'surtir.grupo.estadoEnProceso', clase: 'en-proceso' },
  [GROUP_STATUS.NOT_STARTED]: { key: 'common.pendiente', clase: 'pendiente' },
  [GROUP_STATUS.EXCEEDED]: { key: 'surtir.grupo.estadoExcedido', clase: 'excedido' },
  [GROUP_STATUS.UNDEFINED]: { key: 'surtir.grupo.estadoPorDefinir', clase: 'por-definir' },
}

function grupoEstadoBadge(t, summary) {
  const info = GRUPO_ESTADO_INFO[summary.status]
  return { texto: t(info.key, { n: summary.excess }), clase: info.clase }
}

// Un grupo (marca+pulgadas) completo: encabezado + fila de captions + sus
// SKU. Extraído como función aparte (no JSX inline) para poder reutilizarlo
// tanto suelto como envuelto junto al encabezado de marca (ver más abajo,
// print-brand-block-intro) sin duplicar el markup.
function renderSizeGroup(t, group) {
  const requestedText = group.requested === null || group.requested === undefined
    ? t('surtir.grupo.porDefinir')
    : group.requested
  const pendingText = group.summary.pending === null || group.summary.pending === undefined
    ? '—'
    : group.summary.pending
  const estadoGrupo = grupoEstadoBadge(t, group.summary)

  return (
    <div key={group.key} className="print-size-group">
      <header className="print-size-group-header">
        <div className="print-size-group-nombre">
          <h3>{group.brand} {group.size}&quot;</h3>
          <span className="print-size-group-badge">
            {t('surtir.grupo.skuCount', { count: group.products.length })}
          </span>
        </div>
        <div className="print-size-group-metricas">
          <div className="print-size-group-metrica">
            <span>{t('surtir.grupo.solicitadoGrupo')}</span>
            <strong>{requestedText}</strong>
          </div>
          <div className="print-size-group-metrica">
            <span>{t('surtir.grupo.surtidoGrupo')}</span>
            <strong>{group.summary.supplied}</strong>
          </div>
          <div className="print-size-group-metrica">
            <span>{t('surtir.grupo.pendienteGrupo')}</span>
            <strong>{pendingText}</strong>
          </div>
        </div>
        <span className={`print-estado-badge print-size-group-estado ${estadoGrupo.clase}`}>
          {estadoGrupo.texto}
        </span>
      </header>

      {/* Fila compacta de una sola línea: la marca y pulgadas ya viven en el
          encabezado del grupo de arriba, así que nunca se repiten aquí (ver
          instrucciones de impresión de una sola hoja). Cuando el grupo
          comparte meta entre varios SKU, tampoco se repite "Meta
          compartida"/"Por definir" en cada renglón — ese dato ya está en las
          métricas del grupo — el renglón solo muestra lo que le pertenece a
          ESE SKU (surtido + estado); cuando el grupo tiene un único SKU con
          meta propia, sí se muestra su meta/pendiente individual. */}
      {group.products.map((tv, i) => {
        const avance = calcularAvanceSku(tv, group)
        return (
          <div key={tv._idx} className="print-sku-row">
            <span className="print-sku-num">{i + 1}.</span>
            <span className="print-sku-modelo">{tv.modelo || '—'}</span>
            {(tv.condiciones || []).length > 0 && (
              <span className="print-cond-mini">
                {tv.condiciones.map((c) => (
                  <span key={c} className={`print-cond-chip cond-${c.toLowerCase()}`}>{c}</span>
                ))}
              </span>
            )}
            <span className="print-sku-metricas">
              {avance.solicitada !== null && (
                <>
                  <span className="print-sku-metrica">{t('imprimir.metaCorta')} <b>{avance.solicitada}</b></span>
                  <span className="print-sku-metrica">{t('common.pendiente')} <b>{avance.pendiente === null ? '—' : avance.pendiente}</b></span>
                </>
              )}
              <span className="print-sku-metrica">{t('common.surtido')} <b>{avance.surtida}</b></span>
            </span>
            <span className={`print-estado-badge ${ESTADO_SKU_CLASE[avance.estado]}`}>
              {avance.estado === 'SIN_SOLICITUD' ? t('imprimir.sinSolicitud') : t(`common.${ESTADO_SKU_CLASE[avance.estado]}`)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Hoja de impresión de un pedido, ya con todos los valores resueltos —
// SIN acceso a datos (ni Mongo, ni sesión): recibe todo por props para que
// tanto la ruta real (app/pedidos/[id]/imprimir/page.jsx) como cualquier
// vista de previsualización puedan renderizar EXACTAMENTE la misma hoja.
export default function OrderPrintSheet({
  t,
  pedido,
  brandSections,
  televisiones,
  pedidoRef,
  fechaFmt,
  fechaLimiteFmt,
  tiempo,
  generadoFmt,
  generadoPorNombre,
  totalRequerido,
  totalSurtido,
  progresoPct,
  pendiente,
}) {
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

        {/* 4) Productos — marca → pulgadas → SKU. Nunca la tabla plana
            anterior: la meta pertenece al grupo (marca+pulgadas), así que
            cada nivel se resuelve con las mismas funciones de
            lib/surtido-grupos.js que ya usan Surtir/Nuevo/Editar. */}
        <div className="print-productos">
          {brandSections.map((brand) => {
            const resumenMarca = calculateBrandSummary(brand)
            const [primerGrupo, ...restoGrupos] = brand.sizes
            return (
              <section key={brand.key} className="print-brand-block">
                {/* El encabezado de marca y su PRIMER grupo viajan juntos como
                    un solo bloque atómico (break-inside: avoid) — un simple
                    "avoid" de un solo lado en el encabezado no bastaba: Chrome
                    seguía dejando "SAMSUNG" solo al pie de una hoja con sus
                    grupos abriendo la siguiente (comprobado con LORENA). Los
                    demás grupos de la marca siguen sueltos y pueden fluir a
                    más hojas con normalidad. */}
                <div className="print-brand-block-intro">
                  <header className="print-brand-block-header">
                    <h2 className="print-brand-block-nombre">{brand.label.toUpperCase()}</h2>
                    <p className="print-brand-block-resumen">
                      {t('surtir.grupo.skuCount', { count: resumenMarca.skuCount })}
                      {' · '}{t('surtir.resumenPedido.totalSolicitado')}: {resumenMarca.requestedDefinedTotal}
                      {' · '}{t('surtir.grupo.surtidas')}: {resumenMarca.suppliedTotal}
                      {' · '}{t('surtir.grupo.pendientes')}: {resumenMarca.pendingTotal}
                      {resumenMarca.undefinedGroupsCount > 0 && (
                        <> · {t('surtir.grupo.grupoPorDefinir', { count: resumenMarca.undefinedGroupsCount })}</>
                      )}
                    </p>
                  </header>
                  {primerGrupo && renderSizeGroup(t, primerGrupo)}
                </div>

                {restoGrupos.map((group) => renderSizeGroup(t, group))}
              </section>
            )
          })}
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
