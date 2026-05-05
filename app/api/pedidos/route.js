import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { MARCAS, PULGADAS, CONDICIONES, UNIDADES } from '@/lib/catalogos'
import { getUsuario } from '@/lib/auth'

export async function POST(req) {
  const usuario = await getUsuario()

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { pedidoNombre, condiciones, televisiones } = body

  if (typeof pedidoNombre !== 'string' || !pedidoNombre.trim()) {
    return NextResponse.json({ error: 'Nombre de pedido requerido' }, { status: 400 })
  }
  if (!Array.isArray(condiciones) || condiciones.some((c) => !CONDICIONES.includes(c))) {
    return NextResponse.json({ error: 'Condiciones inválidas' }, { status: 400 })
  }
  if (!Array.isArray(televisiones) || televisiones.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos una televisión' }, { status: 400 })
  }

  const tvsLimpias = []
  for (const [i, tv] of televisiones.entries()) {
    if (!MARCAS.includes(tv.marca)) {
      return NextResponse.json({ error: `TV #${i + 1}: marca inválida` }, { status: 400 })
    }
    const pulgadas = Number(tv.pulgadas)
    if (!PULGADAS.includes(pulgadas)) {
      return NextResponse.json({ error: `TV #${i + 1}: pulgadas inválidas` }, { status: 400 })
    }
    const cantidad = Number(tv.cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return NextResponse.json({ error: `TV #${i + 1}: cantidad inválida` }, { status: 400 })
    }
    const unidad = UNIDADES.includes(tv.unidad) ? tv.unidad : 'pieza'
    tvsLimpias.push({
      marca: tv.marca,
      pulgadas,
      modelo: typeof tv.modelo === 'string' ? tv.modelo.trim() : '',
      cantidad,
      unidad,
      cantidadSurtida: 0,
    })
  }

  const db = await getDb()
  const result = await db.collection('pedidos').insertOne({
    pedidoNombre: pedidoNombre.trim(),
    condiciones,
    televisiones: tvsLimpias,
    fecha: new Date(),
    creadoPor: usuario?.userId || null,
    creadoPorNombre: usuario?.nombre || null,
    creadoPorRol: usuario?.rol || null,
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
