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
  // Ajustado para la base más grande (1.85rem por línea de TV).
  // fit-to-page.jsx hace el ajuste fino al cargar, esto solo evita
  // un flash de tamaño demasiado grande antes de medir.
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

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

  const grupos = agruparPorMarca(pedido.televisiones)
  const totalPallets = pedido.televisiones.reduce(
    (s, tv) => s + (tv.unidad === 'pallet' ? tv.cantidad : 0), 0
  )
  const totalPiezas = pedido.televisiones.reduce(
    (s, tv) => s + (tv.unidad !== 'pallet' ? tv.cantidad : 0), 0
  )
  const totalLineas = grupos.reduce((s, g) => s + g.items.length + 1, 0)
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const colsClass = decidirColumnas(totalLineas)
  const multInicial = estimarMultiplicador(totalLineas)

  const totalLabel = formatearSubtotal(totalPallets, totalPiezas)

  return (
    <main className="imprimir">
      <PrintButton />
      <FitToPage />
      <div
        className={`contenido-imprimir ${colsClass}`}
        style={{ '--fs-mult': String(multInicial) }}
      >
        <header className="encabezado">
          <div className="brand">MITECHNOLOGIES</div>
          <h1>
            PEDIDO {pedido.numeroPedido ? `#${pedido.numeroPedido}` : ''}: {pedido.pedidoNombre.toUpperCase()}
          </h1>
          {pedido.condiciones.length > 0 && (
            <h2>CONDICIONES: {pedido.condiciones.join(' / ')}</h2>
          )}
          <div className="meta">{fechaFmt}</div>
          <hr />
        </header>

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
                    <span className="tv-pulgadas">{tv.pulgadas}"</span>
                    <span className="tv-cantidad">
                      {tv.cantidad} {unidadLabel(tv.cantidad, tv.unidad, true)}
                    </span>
                    {tv.modelo ? <span className="tv-modelo">({tv.modelo})</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="total-final">
          <hr />
          <div>
            TOTAL: {totalLabel} · {grupos.length} {grupos.length === 1 ? 'MARCA' : 'MARCAS'}
          </div>
        </footer>
      </div>
    </main>
  )
}
