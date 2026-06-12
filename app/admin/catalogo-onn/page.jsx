import { getDb } from '@/lib/mongodb'
import CatalogoOnnCliente from './catalogo-cliente'

export const dynamic = 'force-dynamic'

async function obtenerCatalogo() {
  const db = await getDb()
  const items = await db.collection('catalogo_onn').find({}).sort({ modelo: 1 }).toArray()
  return items.map((it) => ({
    id: it._id.toString(),
    modelo: it.modelo,
    pulgadas: it.pulgadas,
  }))
}

export default async function CatalogoOnnPage() {
  const items = await obtenerCatalogo()
  return <CatalogoOnnCliente items={items} />
}
