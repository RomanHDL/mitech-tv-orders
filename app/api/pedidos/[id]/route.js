import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export async function GET(_req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  const db = await getDb()
  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(id) })
  if (!pedido) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return NextResponse.json({
    ...pedido,
    _id: pedido._id.toString(),
  })
}

export async function DELETE(_req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  const db = await getDb()
  const result = await db.collection('pedidos').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// Actualiza la cantidad surtida de un TV específico del pedido.
// Body: { tvIndex: number, cantidadSurtida: number }
export async function PATCH(req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { tvIndex, cantidadSurtida } = body

  if (!Number.isInteger(tvIndex) || tvIndex < 0) {
    return NextResponse.json({ error: 'tvIndex inválido' }, { status: 400 })
  }
  if (!Number.isInteger(cantidadSurtida) || cantidadSurtida < 0) {
    return NextResponse.json({ error: 'cantidadSurtida inválida' }, { status: 400 })
  }

  const db = await getDb()

  const pedido = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    { projection: { televisiones: 1 } }
  )
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  const tv = pedido.televisiones?.[tvIndex]
  if (!tv) {
    return NextResponse.json({ error: 'TV no existe en el pedido' }, { status: 400 })
  }
  if (cantidadSurtida > tv.cantidad) {
    return NextResponse.json({ error: 'No se puede surtir más que la cantidad pedida' }, { status: 400 })
  }

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $set: { [`televisiones.${tvIndex}.cantidadSurtida`]: cantidadSurtida } }
  )

  return NextResponse.json({ ok: true })
}
