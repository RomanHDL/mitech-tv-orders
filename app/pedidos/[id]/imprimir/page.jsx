import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { unidadLabel, estadoLabel } from '@/lib/catalogos'
import { calcularTotales, diasHastaLimite, normalizeOrderStatus } from '@/lib/estado-pedido'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe } from '@/lib/intl-format'
import PrintButton from './print-button'
import FitToPage from './fit-to-page'
import './imprimir.css'

async function obtenerPedido(id) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDb()
  return db.collection('pedidos').findOne({ _id: new ObjectId(id) })
}

function agruparPorMarca(televisiones) {
  const grupos = {}
  for (const tvRaw of televisiones) {
    // Compatibilidad con pedidos creados antes de que una partida pudiera
    // tener varias condiciones a la vez (guardaban `condicion` string suelto).
    const tv = {
      ...tvRaw,
      condiciones: Array.isArray(tvRaw.condiciones) ? tvRaw.condiciones : (tvRaw.condicion ? [tvRaw.condicion] : []),
    }
    if (!grupos[tv.marca]) grupos[tv.marca] = []
    grupos[tv.marca].push(tv)
  }
  return Object.keys(grupos).sort().map((marca) => {
    const items = grupos[marca].sort((a, b) => a.pulgadas - b.pulgadas)
    const pallets = items.reduce((s, tv) => s + (tv.unidad === 'pallet' ? tv.cantidad : 0), 0)
    const piezas = items.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? tv.cantidad : 0), 0)
    return { marca, items, pallets, piezas }
  })
}

function formatearSubtotal(t, pallets, piezas) {
  const partes = []
  if (pallets > 0) partes.push(`${pallets} ${(pallets === 1 ? t('imprimir.pallet') : t('imprimir.palletPlural')).toUpperCase()}`)
  if (piezas > 0) partes.push(`${piezas} ${(piezas === 1 ? t('imprimir.pieza') : t('imprimir.piezaPlural')).toUpperCase()}`)
  return partes.join(' · ')
}

function estimarMultiplicador(lineas) {
  if (lineas > 90) return 0.4
  if (lineas > 60) return 0.55
  if (lineas > 35) return 0.7
  if (lineas > 18) return 0.85
  return 1
}

function decidirColumnas(lineas) {
  if (lineas > 60) return 'cols-3'
  if (lineas > 10) return 'cols-2'
  return 'cols-1'
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

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()
  const t = await getServerT()
  const lang = await getServerLang()

  const grupos = agruparPorMarca(pedido.televisiones)
  const totalPallets = pedido.televisiones.reduce(
    (s, tv) => s + (tv.unidad === 'pallet' ? (tv.cantidad || 0) : 0), 0
  )
  const totalPiezas = pedido.televisiones.reduce(
    (s, tv) => s + (tv.unidad !== 'pallet' ? (tv.cantidad || 0) : 0), 0
  )
  const totalModelos = pedido.televisiones.length
  const cantidadTotalPedido =
    typeof pedido.cantidadTotal === 'number' && pedido.cantidadTotal > 0
      ? pedido.cantidadTotal
      : null
  const totalLineas = grupos.reduce((s, g) => s + g.items.length + 1, 0)
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const fechaLimiteFmt = formatearFechaLimite(pedido.fechaLimite, lang)
  const { progresoPct, pendiente } = calcularTotales(pedido)
  const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: pedido.estadoOperativo || null })
  const dias = diasHastaLimite(pedido.fechaLimite)
  const tiempo = tiempoRestante(t, estado, dias, pendiente)
  const generadoFmt = new Date().toLocaleString(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const colsClass = decidirColumnas(totalLineas)
  const multInicial = estimarMultiplicador(totalLineas)
  const totalLabel = formatearSubtotal(t, totalPallets, totalPiezas)
  const pedidoCorto = String(pedido._id).slice(-6).toUpperCase()

  return (
    <main className="imprimir">
      <PrintButton />
      <FitToPage />
      <div
        className={`contenido-imprimir ${colsClass}`}
        style={{ '--fs-mult': String(multInicial) }}
      >
        {/* Top bar: marca + ID corto del pedido */}
        <div className="top-bar">
          <span className="brand">MITECHNOLOGIES</span>
          <span className="top-bar-ref">REF · {pedidoCorto}</span>
        </div>

        {/* Encabezado principal */}
        <header className="encabezado">
          {pedido.numeroPedido && (
            <div className="pedido-numero">N° {pedido.numeroPedido}</div>
          )}
          <h1 className="pedido-nombre">{pedido.pedidoNombre.toUpperCase()}</h1>

          {/* Fila de info: 4 datos en columnas */}
          <div className="info-grid">
            <div className="info-cell">
              <div className="info-label">{t('pedidos.colFechaCreacion')}</div>
              <div className="info-value">{fechaFmt}</div>
            </div>
            {fechaLimiteFmt && (
              <div className="info-cell">
                <div className="info-label">{t('pedidoForm.fechaLimite')}</div>
                <div className="info-value">{fechaLimiteFmt}</div>
              </div>
            )}
            {tiempo && (
              <div className="info-cell">
                <div className="info-label">{t('imprimir.tiempoRestante')}</div>
                <div className={`info-value info-tiempo tono-${tiempo.tono}`}>
                  {tiempo.texto}
                </div>
              </div>
            )}
            {pedido.creadoPorNombre && (
              <div className="info-cell">
                <div className="info-label">{t('imprimir.capturo')}</div>
                <div className="info-value">{pedido.creadoPorNombre}</div>
              </div>
            )}
          </div>

          {pedido.condiciones?.length > 0 && (
            <div className="condiciones-banda">
              <span className="condiciones-label">{t('imprimir.condicionesLabel')}</span>
              {pedido.condiciones.map((c) => (
                <span key={c} className={`condicion-chip cond-${c.toLowerCase()}`}>
                  {c}
                </span>
              ))}
            </div>
          )}

          {typeof pedido.comentarios === 'string' && pedido.comentarios.trim() && (
            <div className="comentarios-banda">
              <span className="comentarios-banda-label">{t('imprimir.comentariosLabel')}</span>
              <p className="comentarios-banda-texto">{pedido.comentarios}</p>
            </div>
          )}

          <hr />
        </header>

        {/* Cuerpo: bloques por marca */}
        <div className="contenido-pedido">
          {grupos.map(({ marca, items, pallets, piezas }) => (
            <section key={marca} className="marca-bloque">
              <div className="marca-header">
                <h2 className="marca-titulo">{marca.toUpperCase()}</h2>
                <span className="marca-subtotal">{formatearSubtotal(t, pallets, piezas)}</span>
              </div>
              <ul>
                {items.map((tv, i) => (
                  <li key={i} className={tv.unidad === 'pallet' ? 'es-pallet' : ''}>
                    <span className="col-pulgadas">{tv.pulgadas}"</span>
                    {tv.condiciones?.length > 0 && (
                      <span className="col-condicion">
                        {tv.condiciones.map((c) => (
                          <span key={c} className={`condicion-chip cond-${c.toLowerCase()}`}>{c}</span>
                        ))}
                      </span>
                    )}
                    <span className="col-cantidad">
                      {tv.sinLimite ? t('imprimir.sinLimiteAbrev') : tv.cantidad}
                    </span>
                    <span className="col-unidad">
                      {tv.sinLimite ? '' : unidadLabel(t, tv.cantidad, tv.unidad, true)}
                    </span>
                    <span className="col-modelo">
                      {tv.modelo ? tv.modelo : <span className="modelo-vacio">—</span>}
                      {tv.modelosAlternativos?.length > 0 && (
                        <span className="modelo-alt-hint" title={t('common.tambienValido', { lista: tv.modelosAlternativos.join(', ') })}>
                          {t('imprimir.skusAlt', { count: tv.modelosAlternativos.length })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Resumen final */}
        <section className="resumen-final">
          <hr className="resumen-rule" />
          <div className="resumen-grid">
            {cantidadTotalPedido !== null ? (
              <div className="resumen-cell">
                <div className="resumen-numero">{cantidadTotalPedido}</div>
                <div className="resumen-label">{t('imprimir.totalPedido')}</div>
              </div>
            ) : (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPiezas}</div>
                <div className="resumen-label">{totalPiezas === 1 ? t('imprimir.pieza') : t('imprimir.piezaPlural')}</div>
              </div>
            )}
            {totalPallets > 0 && (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPallets}</div>
                <div className="resumen-label">{totalPallets === 1 ? t('imprimir.pallet') : t('imprimir.palletPlural')}</div>
              </div>
            )}
            <div className="resumen-cell">
              <div className="resumen-numero">{totalModelos}</div>
              <div className="resumen-label">{totalModelos === 1 ? t('imprimir.modelo') : t('pedidoForm.modelos')}</div>
            </div>
            <div className="resumen-cell">
              <div className="resumen-numero">{grupos.length}</div>
              <div className="resumen-label">{grupos.length === 1 ? t('common.marca') : t('pedidoForm.marcas')}</div>
            </div>
          </div>
        </section>

        {/* Pie de página */}
        <footer className="pie">
          {t('imprimir.generadoPrefijo', { fecha: generadoFmt })} · {totalLabel} · {totalModelos} {t('imprimir.modeloFooter')} · {grupos.length}{' '}
          {grupos.length === 1 ? t('imprimir.marcaFooterSingular') : t('imprimir.marcaFooterPlural')}
        </footer>
      </div>
    </main>
  )
}
