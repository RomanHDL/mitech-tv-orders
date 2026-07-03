import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { MARCAS, PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX } from '@/lib/catalogos'
import { getUsuario } from '@/lib/auth'

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

// Actualiza cantidadSurtida de un TV específico (usado por el módulo de surtido).
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
    { projection: { televisiones: 1, creadoPor: 1, creadoPorRol: 1 } }
  )
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Una capturista solo puede tocar pedidos cuyo dueño es ella misma.
  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista' && pedido.creadoPor !== usuario.userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const tv = pedido.televisiones?.[tvIndex]
  if (!tv) {
    return NextResponse.json({ error: 'TV no existe en el pedido' }, { status: 400 })
  }
  if (!tv.sinLimite && cantidadSurtida > tv.cantidad) {
    return NextResponse.json({ error: 'No se puede surtir más que la cantidad pedida' }, { status: 400 })
  }

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $set: { [`televisiones.${tvIndex}.cantidadSurtida`]: cantidadSurtida } }
  )

  return NextResponse.json({ ok: true })
}

// Edición completa del pedido (admin). Preserva cantidadSurtida si el TV
// (marca, pulgadas, modelo, unidad) sigue existiendo en la nueva versión.
export async function PUT(req, { params }) {
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

  const db = await getDb()
  const existing = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    { projection: { televisiones: 1 } }
  )
  if (!existing) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  const tvsExistentes = existing.televisiones || []

  const tvsLimpias = []
  for (const [i, tv] of televisiones.entries()) {
    if (!MARCAS.includes(tv.marca)) {
      return NextResponse.json({ error: `TV #${i + 1}: marca inválida` }, { status: 400 })
    }
    const pulgadas = Number(tv.pulgadas)
    if (!PULGADAS.includes(pulgadas)) {
      return NextResponse.json({ error: `TV #${i + 1}: pulgadas inválidas` }, { status: 400 })
    }
    const tvSinLimite = !!tv.sinLimite
    const cantidad = Number(tv.cantidad) || 0
    if (!tvSinLimite && (!Number.isInteger(cantidad) || cantidad < 1)) {
      return NextResponse.json({ error: `TV #${i + 1}: cantidad inválida` }, { status: 400 })
    }
    const cantidadFinal = tvSinLimite ? 0 : cantidad
    const unidad = UNIDADES.includes(tv.unidad) ? tv.unidad : 'pieza'
    const modelo = typeof tv.modelo === 'string' ? tv.modelo.trim().toUpperCase() : ''
    if (!SKU_REGEX.test(modelo)) {
      return NextResponse.json(
        { error: `TV #${i + 1}: captura el modelo / SKU (mín. 3 letras o números)` },
        { status: 400 }
      )
    }

    // Preservar cantidadSurtida si hay match exacto
    const matching = tvsExistentes.find(
      (v) =>
        v.marca === tv.marca &&
        v.pulgadas === pulgadas &&
        (v.modelo || '') === modelo &&
        (v.unidad || 'pieza') === unidad
    )
    const cantidadSurtida = matching
      ? (tvSinLimite ? (matching.cantidadSurtida || 0) : Math.min(cantidadFinal, matching.cantidadSurtida || 0))
      : 0

    // SKUs alternativos (cualquiera de ellos sirve para este mismo renglón).
    // Campo opcional/aditivo: se limpia igual que el SKU principal y se
    // descartan silenciosamente los que no sean válidos.
    const modelosAlternativos = Array.isArray(tv.modelosAlternativos)
      ? tv.modelosAlternativos
          .map((m) => (typeof m === 'string' ? m.trim().toUpperCase() : ''))
          .filter((m) => SKU_REGEX.test(m) && m !== modelo)
      : []

    tvsLimpias.push({
      marca: tv.marca,
      pulgadas,
      modelo,
      modelosAlternativos,
      cantidad: cantidadFinal,
      unidad,
      sinLimite: tvSinLimite,
      cantidadSurtida,
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

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        numeroPedido: numeroPedido.trim(),
        pedidoNombre: pedidoNombre.trim(),
        condiciones,
        cantidadTotal: cantidadTotalLimpia,
        televisiones: tvsLimpias,
        fechaLimite,
      },
    }
  )

  return NextResponse.json({ ok: true })
}
