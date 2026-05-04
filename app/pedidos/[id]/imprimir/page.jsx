import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import PrintButton from './print-button'
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

// Decide tamaño de letra según cantidad total de líneas para que quepa en una hoja
function calcularSize(grupos) {
  const lineas = grupos.reduce((s, g) => s + g.items.length + 1, 0)
  if (lineas > 60) return 'size-xl'
  if (lineas > 35) return 'size-lg'
  if (lineas > 18) return 'size-md'
  return 'size-sm'
}

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

  const grupos = agruparPorMarca(pedido.televisiones)
  const totalTvs = pedido.televisiones.reduce((s, tv) => s + tv.cantidad, 0)
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const sizeClass = calcularSize(grupos)
  const usarColumnas = sizeClass !== 'size-sm'

  return (
    <main className={`imprimir ${sizeClass}`}>
      <PrintButton />

      <header className="encabezado">
        <div className="brand">MITECHNOLOGIES</div>
        <h1>PEDIDO: {pedido.pedidoNombre.toUpperCase()}</h1>
        {pedido.condiciones.length > 0 && (
          <h2>CONDICIONES: {pedido.condiciones.join(' / ')}</h2>
        )}
        <div className="meta">{fechaFmt}</div>
        <hr />
      </header>

      <div className={`contenido-pedido ${usarColumnas ? 'dos-columnas' : ''}`}>
        {grupos.map(({ marca, items, subtotal }) => (
          <section key={marca} className="marca-bloque">
            <div className="marca-header">
              <h2 className="marca-titulo">{marca.toUpperCase()}</h2>
              <span className="marca-subtotal">{subtotal} {subtotal === 1 ? 'TV' : 'TVs'}</span>
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
    </main>
  )
}
