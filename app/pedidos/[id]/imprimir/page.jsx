import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
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
  return Object.keys(grupos).sort().map((marca) => ({
    marca,
    items: grupos[marca].sort((a, b) => a.pulgadas - b.pulgadas),
    subtotal: grupos[marca].reduce((s, tv) => s + tv.cantidad, 0),
  }))
}

// Estimación inicial de la escala para minimizar el "salto" antes de que JS ajuste.
function estimarMultiplicador(lineas) {
  if (lineas > 90) return 0.45
  if (lineas > 60) return 0.6
  if (lineas > 35) return 0.75
  if (lineas > 18) return 0.9
  return 1
}

// Decide cantidad de columnas según el tamaño del pedido.
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
  const totalTvs = pedido.televisiones.reduce((s, tv) => s + tv.cantidad, 0)
  const totalLineas = grupos.reduce((s, g) => s + g.items.length + 1, 0)
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const colsClass = decidirColumnas(totalLineas)
  const multInicial = estimarMultiplicador(totalLineas)

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
          <h1>PEDIDO: {pedido.pedidoNombre.toUpperCase()}</h1>
          {pedido.condiciones.length > 0 && (
            <h2>CONDICIONES: {pedido.condiciones.join(' / ')}</h2>
          )}
          <div className="meta">{fechaFmt}</div>
          <hr />
        </header>

        <div className="contenido-pedido">
          {grupos.map(({ marca, items, subtotal }) => (
            <section key={marca} className="marca-bloque">
              <div className="marca-header">
                <h2 className="marca-titulo">{marca.toUpperCase()}</h2>
                <span className="marca-subtotal">
                  {subtotal} {subtotal === 1 ? 'TV' : 'TVs'}
                </span>
              </div>
              <ul>
                {items.map((tv, i) => (
                  <li key={i}>
                    <span className="tv-pulgadas">{tv.pulgadas}"</span>
                    <span className="tv-cantidad">
                      {tv.cantidad} {tv.cantidad === 1 ? 'PIEZA' : 'PIEZAS'}
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
            TOTAL: {totalTvs} TVs · {grupos.length} {grupos.length === 1 ? 'MARCA' : 'MARCAS'}
          </div>
        </footer>
      </div>
    </main>
  )
}
