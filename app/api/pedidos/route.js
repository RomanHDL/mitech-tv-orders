import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { MARCAS, PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX } from '@/lib/catalogos'
import { getUsuario } from '@/lib/auth'

export async function POST(req) {
  const usuario = await getUsuario()

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { numeroPedido, pedidoNombre, condiciones, televisiones, fechaLimite, cantidadTotal } = body

  if (typeof numeroPedido !== 'string' || !numeroPedido.trim()) {
    return NextResponse.json({ error: 'Número de pedido requerido' }, { status: 400 })
  }
  if (typeof pedidoNombre !== 'string' || !pedidoNombre.trim()) {
    return NextResponse.json({ error: 'Nombre de pedido requerido' }, { status: 400 })
  }
  if (!Array.isArray(condiciones) || condiciones.some((c) => !CONDICIONES.includes(c))) {
    return NextResponse.json({ error: 'Condiciones inválidas' }, { status: 400 })
  }
  if (!Array.isArray(televisiones) || televisiones.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos una televisión' }, { status: 400 })
  }

  if (typeof fechaLimite !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)) {
    return NextResponse.json({ error: 'Fecha límite requerida' }, { status: 400 })
  }

  let cantidadTotalLimpia = null
  if (cantidadTotal !== null && cantidadTotal !== undefined && cantidadTotal !== '') {
    const n = Number(cantidadTotal)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: 'Cantidad total inválida' }, { status: 400 })
    }
    cantidadTotalLimpia = n
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
    const sku = typeof tv.modelo === 'string' ? tv.modelo.trim().toUpperCase() : ''
    if (!SKU_REGEX.test(sku)) {
      return NextResponse.json(
        { error: `TV #${i + 1}: el SKU debe tener de 8 a 10 letras o números` },
        { status: 400 }
      )
    }
    const tvSinLimite = !!tv.sinLimite
    const cantidad = Number(tv.cantidad) || 0
    if (!tvSinLimite && (!Number.isInteger(cantidad) || cantidad < 1)) {
      return NextResponse.json({ error: `TV #${i + 1}: cantidad inválida` }, { status: 400 })
    }
    const unidad = UNIDADES.includes(tv.unidad) ? tv.unidad : 'pieza'
    tvsLimpias.push({
      marca: tv.marca,
      pulgadas,
      modelo: sku,
      cantidad: tvSinLimite ? 0 : cantidad,
      unidad,
      sinLimite: tvSinLimite,
      cantidadSurtida: 0,
    })
  }

  if (cantidadTotalLimpia !== null) {
    const sumaTvs = tvsLimpias.reduce((s, tv) => s + (tv.sinLimite ? 0 : tv.cantidad), 0)
    if (sumaTvs > cantidadTotalLimpia) {
      return NextResponse.json(
        { error: `La suma de cantidades (${sumaTvs}) excede la cantidad total del pedido (${cantidadTotalLimpia})` },
        { status: 400 }
      )
    }
  }

  const db = await getDb()
  const result = await db.collection('pedidos').insertOne({
    numeroPedido: numeroPedido.trim(),
    pedidoNombre: pedidoNombre.trim(),
    condiciones,
    cantidadTotal: cantidadTotalLimpia,
    televisiones: tvsLimpias,
    fecha: new Date(),
    fechaLimite,
    creadoPor: usuario?.userId || null,
    creadoPorNombre: usuario?.nombre || null,
    creadoPorRol: usuario?.rol || null,
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
