import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { MARCAS, PULGADAS, CONDICIONES, CONDICIONES_PARTIDA, UNIDADES, SKU_REGEX } from '@/lib/catalogos'
import { getUsuario, requireModule } from '@/lib/auth'
import { registrarEvento } from '@/lib/eventos'
import { calcularTotales } from '@/lib/estado-pedido'

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
    {
      projection: {
        televisiones: 1, creadoPor: 1, creadoPorRol: 1,
        cantidadTotal: 1, numeroPedido: 1, pedidoNombre: 1, condiciones: 1,
      },
    }
  )
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Tracking de surtido: capturista necesita 'orders', surtidor necesita
  // 'picking'; admin queda sin restricción adicional de módulo. Además, una
  // capturista solo puede tocar pedidos cuyo dueño es ella misma.
  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista') {
    const chk = await requireModule('orders')
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
    if (pedido.creadoPor !== usuario.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  } else if (usuario?.rol === 'surtidor') {
    const chk = await requireModule('picking')
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  }

  const tv = pedido.televisiones?.[tvIndex]
  if (!tv) {
    return NextResponse.json({ error: 'TV no existe en el pedido' }, { status: 400 })
  }
  if (!tv.sinLimite && cantidadSurtida > tv.cantidad) {
    return NextResponse.json({ error: 'No se puede surtir más que la cantidad pedida' }, { status: 400 })
  }

  const { progresoPct: pctAntes } = calcularTotales(pedido)

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $set: { [`televisiones.${tvIndex}.cantidadSurtida`]: cantidadSurtida } }
  )

  // Solo se registra evento cuando el progreso CRUZA un umbral real (0%→algo,
  // algo→100%) — nunca uno por cada unidad marcada, para no saturar la
  // bitácora con ruido.
  const televisionesDespues = pedido.televisiones.map((t, i) =>
    i === tvIndex ? { ...t, cantidadSurtida } : t
  )
  const { progresoPct: pctDespues, totalRequerido, totalSurtido } = calcularTotales({
    ...pedido,
    televisiones: televisionesDespues,
  })

  if (pctAntes === 0 && pctDespues > 0) {
    await registrarEvento(db, pedido, {
      tipo: 'SURTIDO',
      estadoAnterior: 'PENDIENTE',
      estadoNuevo: 'EN_PROCESO',
      usuarioId: usuario?.userId || null,
      usuarioNombre: usuario?.nombre || null,
      detalle: 'Surtido iniciado',
    })
  }
  if (pctAntes < 100 && pctDespues >= 100) {
    await registrarEvento(db, pedido, {
      tipo: 'SURTIDO',
      estadoAnterior: 'EN_PROCESO',
      estadoNuevo: 'TERMINADO',
      usuarioId: usuario?.userId || null,
      usuarioNombre: usuario?.nombre || null,
      detalle: '100% surtido',
      detalleSecundario: `${totalSurtido} de ${totalRequerido} artículos surtidos`,
    })
  }

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
    {
      projection: {
        televisiones: 1, numeroPedido: 1, pedidoNombre: 1, condiciones: 1,
        fechaLimite: 1, cantidadTotal: 1,
      },
    }
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
    if (!CONDICIONES_PARTIDA.includes(tv.condicion)) {
      return NextResponse.json({ error: `TV #${i + 1}: falta condición` }, { status: 400 })
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

    // Preservar cantidadSurtida si hay match exacto de SKU + condición
    // (marca+pulgadas+modelo+unidad+condicion). Dos partidas del mismo SKU
    // con condición distinta se tratan como líneas independientes.
    const matching = tvsExistentes.find(
      (v) =>
        v.marca === tv.marca &&
        v.pulgadas === pulgadas &&
        (v.modelo || '') === modelo &&
        (v.unidad || 'pieza') === unidad &&
        (v.condicion || '') === tv.condicion
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
      condicion: tv.condicion,
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

  // Detecta qué cambió realmente para no registrar un evento vacío cuando el
  // usuario solo reabre y guarda sin tocar nada.
  const cambios = []
  if (existing.fechaLimite !== fechaLimite) cambios.push('Fecha límite modificada')
  const condicionesAntes = [...(existing.condiciones || [])].sort().join(',')
  const condicionesDespues = [...condiciones].sort().join(',')
  if (condicionesAntes !== condicionesDespues) cambios.push('Condiciones actualizadas')
  if ((existing.numeroPedido || '') !== numeroPedido.trim()) cambios.push('Número de pedido actualizado')
  if ((existing.pedidoNombre || '') !== pedidoNombre.trim()) cambios.push('Nombre actualizado')

  const sumaAntes = tvsExistentes.reduce((s, tv) => s + (tv.sinLimite ? 0 : tv.cantidad || 0), 0)
  const sumaDespues = tvsLimpias.reduce((s, tv) => s + (tv.sinLimite ? 0 : tv.cantidad), 0)
  const cambioCantidades = sumaAntes !== sumaDespues
  const mismasLineas =
    tvsExistentes.length === tvsLimpias.length &&
    tvsExistentes.every((v, i) => v.marca === tvsLimpias[i].marca && v.modelo === tvsLimpias[i].modelo && v.condicion === tvsLimpias[i].condicion)

  const usuarioEdita = await getUsuario()
  if (cambios.length > 0 || cambioCantidades) {
    const esSoloCantidades = cambioCantidades && cambios.length === 0 && mismasLineas
    await registrarEvento(
      db,
      { _id: id, numeroPedido: numeroPedido.trim(), pedidoNombre: pedidoNombre.trim(), condiciones },
      {
        tipo: esSoloCantidades ? 'CAMBIO_CANTIDADES' : 'EDICION',
        usuarioId: usuarioEdita?.userId || null,
        usuarioNombre: usuarioEdita?.nombre || null,
        detalle: esSoloCantidades ? 'Cantidades modificadas' : (cambios[0] || 'Pedido editado'),
        detalleSecundario: esSoloCantidades
          ? `De ${sumaAntes} a ${sumaDespues} piezas`
          : (cambios.length > 1 ? cambios.slice(1).join(' · ') : (cambioCantidades ? `Cantidades: de ${sumaAntes} a ${sumaDespues}` : null)),
      }
    )
  }

  return NextResponse.json({ ok: true })
}
