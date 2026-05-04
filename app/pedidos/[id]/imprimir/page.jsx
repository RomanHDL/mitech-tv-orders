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
  }))
}

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()

  const grupos = agruparPorMarca(pedido.televisiones)

  return (
    <main className="imprimir">
      <PrintButton />

      <header className="encabezado">
        <h1>PEDIDO: {pedido.pedidoNombre.toUpperCase()}</h1>
        {pedido.condiciones.length > 0 && (
          <h2>CONDICIONES: {pedido.condiciones.join(' / ')}</h2>
        )}
        <hr />
      </header>

      {grupos.map(({ marca, items }) => (
        <section key={marca} className="marca-bloque">
          <h2 className="marca-titulo">{marca.toUpperCase()}</h2>
          <ul>
            {items.map((tv, i) => (
              <li key={i}>
                {tv.pulgadas}" – {tv.cantidad} {tv.cantidad === 1 ? 'PIEZA' : 'PIEZAS'}
                {tv.modelo ? ` (${tv.modelo})` : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
