import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { unidadLabel } from '@/lib/catalogos'
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
  for (const tv of televisiones) {
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

function formatearSubtotal(pallets, piezas) {
  const partes = []
  if (pallets > 0) partes.push(`${pallets} ${pallets === 1 ? 'PALLET' : 'PALLETS'}`)
  if (piezas > 0) partes.push(`${piezas} ${piezas === 1 ? 'PIEZA' : 'PIEZAS'}`)
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

function formatearFechaLimite(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function diasHastaLimite(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  const limite = new Date(y, m - 1, d)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((limite.getTime() - hoy.getTime()) / 86400000)
}

function tiempoRestante(dias) {
  if (dias === null) return null
  if (dias < 0) return { texto: `VENCIDO HACE ${Math.abs(dias)} D`, tono: 'rojo' }
  if (dias === 0) return { texto: 'ENTREGA HOY', tono: 'rojo' }
  if (dias === 1) return { texto: 'ENTREGA MAÑANA', tono: 'amarillo' }
  if (dias <= 3) return { texto: `${dias} DÍAS`, tono: 'amarillo' }
  return { texto: `${dias} DÍAS`, tono: 'verde' }
}

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

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
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const fechaLimiteFmt = formatearFechaLimite(pedido.fechaLimite)
  const dias = diasHastaLimite(pedido.fechaLimite)
  const tiempo = tiempoRestante(dias)
  const generadoFmt = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const colsClass = decidirColumnas(totalLineas)
  const multInicial = estimarMultiplicador(totalLineas)
  const totalLabel = formatearSubtotal(totalPallets, totalPiezas)
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
              <div className="info-label">Fecha creación</div>
              <div className="info-value">{fechaFmt}</div>
            </div>
            {fechaLimiteFmt && (
              <div className="info-cell">
                <div className="info-label">Fecha límite</div>
                <div className="info-value">{fechaLimiteFmt}</div>
              </div>
            )}
            {tiempo && (
              <div className="info-cell">
                <div className="info-label">Tiempo restante</div>
                <div className={`info-value info-tiempo tono-${tiempo.tono}`}>
                  {tiempo.texto}
                </div>
              </div>
            )}
            {pedido.creadoPorNombre && (
              <div className="info-cell">
                <div className="info-label">Capturó</div>
                <div className="info-value">{pedido.creadoPorNombre}</div>
              </div>
            )}
          </div>

          {pedido.condiciones?.length > 0 && (
            <div className="condiciones-banda">
              <span className="condiciones-label">CONDICIONES</span>
              {pedido.condiciones.map((c) => (
                <span key={c} className={`condicion-chip cond-${c.toLowerCase()}`}>
                  {c}
                </span>
              ))}
            </div>
          )}

          {typeof pedido.comentarios === 'string' && pedido.comentarios.trim() && (
            <div className="comentarios-banda">
              <span className="comentarios-banda-label">COMENTARIOS DEL ENVÍO</span>
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
                <span className="marca-subtotal">{formatearSubtotal(pallets, piezas)}</span>
              </div>
              <ul>
                {items.map((tv, i) => (
                  <li key={i} className={tv.unidad === 'pallet' ? 'es-pallet' : ''}>
                    <span className="col-pulgadas">{tv.pulgadas}"</span>
                    <span className="col-cantidad">
                      {tv.sinLimite ? 'S/L' : tv.cantidad}
                    </span>
                    <span className="col-unidad">
                      {tv.sinLimite ? '' : unidadLabel(tv.cantidad, tv.unidad, true)}
                    </span>
                    <span className="col-modelo">
                      {tv.modelo ? tv.modelo : <span className="modelo-vacio">—</span>}
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
                <div className="resumen-label">Total del pedido</div>
              </div>
            ) : (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPiezas}</div>
                <div className="resumen-label">{totalPiezas === 1 ? 'Pieza' : 'Piezas'}</div>
              </div>
            )}
            {totalPallets > 0 && (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPallets}</div>
                <div className="resumen-label">{totalPallets === 1 ? 'Pallet' : 'Pallets'}</div>
              </div>
            )}
            <div className="resumen-cell">
              <div className="resumen-numero">{totalModelos}</div>
              <div className="resumen-label">{totalModelos === 1 ? 'Modelo' : 'Modelos'}</div>
            </div>
            <div className="resumen-cell">
              <div className="resumen-numero">{grupos.length}</div>
              <div className="resumen-label">{grupos.length === 1 ? 'Marca' : 'Marcas'}</div>
            </div>
          </div>
        </section>

        {/* Pie de página */}
        <footer className="pie">
          Generado {generadoFmt} · {totalLabel} · {totalModelos} modelos · {grupos.length}{' '}
          {grupos.length === 1 ? 'marca' : 'marcas'}
        </footer>
      </div>
    </main>
  )
}
