import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX, marcaValida } from '@/lib/catalogos'
import { getUsuario, requireModule } from '@/lib/auth'
import { registrarEvento } from '@/lib/eventos'
import { calcularTotales } from '@/lib/estado-pedido'
import { normalizarMarca } from '@/lib/importar-pedido'
import { createGroupKey, filtrarMetasHuerfanas, isRequestedQuantityDefined } from '@/lib/surtido-grupos'
import { getServerT } from '@/lib/i18n-server'

// Un SKU puede llevar varias condiciones a la vez (ej. la misma partida
// acepta GRA y GRB) — se compara como conjunto, sin importar el orden.
// Los pedidos creados antes de este cambio guardan `condicion` (string);
// los nuevos guardan `condiciones` (string[]). Nunca se migra el dato en
// la DB, solo se normaliza al leer para no perder el emparejamiento con
// pedidos históricos.
const condicionesDe = (tv) =>
  Array.isArray(tv.condiciones) ? tv.condiciones : (tv.condicion ? [tv.condicion] : [])
const condicionKey = (tv) => [...condicionesDe(tv)].sort().join(',')

export async function GET(_req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }
  const db = await getDb()
  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(id) })
  if (!pedido) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  return NextResponse.json({
    ...pedido,
    _id: pedido._id.toString(),
  })
}

export async function DELETE(_req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }
  const db = await getDb()
  const result = await db.collection('pedidos').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// Actualiza cantidadSurtida de un TV específico (usado por el módulo de surtido).
// Body: { tvIndex: number, cantidadSurtida: number }
export async function PATCH(req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const { tvIndex, cantidadSurtida } = body

  if (!Number.isInteger(tvIndex) || tvIndex < 0) {
    return NextResponse.json({ error: t('apiPedidos.tvIndexInvalido') }, { status: 400 })
  }
  if (!Number.isInteger(cantidadSurtida) || cantidadSurtida < 0) {
    return NextResponse.json({ error: t('apiPedidos.cantidadSurtidaInvalida') }, { status: 400 })
  }

  const db = await getDb()

  const pedido = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        televisiones: 1, creadoPor: 1, creadoPorRol: 1,
        cantidadTotal: 1, numeroPedido: 1, pedidoNombre: 1, condiciones: 1,
        metasGrupo: 1,
      },
    }
  )
  if (!pedido) {
    return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
  }

  // Tracking de surtido: capturista necesita 'orders', surtidor necesita
  // 'picking'; admin queda sin restricción adicional de módulo. Además, una
  // capturista solo puede tocar pedidos cuyo dueño es ella misma.
  const usuario = await getUsuario()
  if (usuario?.rol === 'capturista') {
    const chk = await requireModule('orders')
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
    if (pedido.creadoPor !== usuario.userId) {
      return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
    }
  } else if (usuario?.rol === 'surtidor') {
    const chk = await requireModule('picking')
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  }

  const tv = pedido.televisiones?.[tvIndex]
  if (!tv) {
    return NextResponse.json({ error: t('apiPedidos.tvNoExiste') }, { status: 400 })
  }
  // Si el grupo (marca+pulgadas) de este TV tiene una meta CONJUNTA definida
  // en metasGrupo, cada SKU aporta libremente al total del grupo — el tope
  // por SKU (tv.cantidad) deja de aplicar, igual que ya pasaba con
  // sinLimite. Sin esa entrada, se preserva la validación histórica.
  const grupoKey = createGroupKey(tv.marca, tv.pulgadas)
  const grupoTieneMeta = !!pedido.metasGrupo && Object.prototype.hasOwnProperty.call(pedido.metasGrupo, grupoKey)
  if (!tv.sinLimite && !grupoTieneMeta && cantidadSurtida > tv.cantidad) {
    return NextResponse.json({ error: t('apiPedidos.excedeSurtido') }, { status: 400 })
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
      detalle: t('eventosDetalle.surtidoIniciado'),
    })
  }
  if (pctAntes < 100 && pctDespues >= 100) {
    await registrarEvento(db, pedido, {
      tipo: 'SURTIDO',
      estadoAnterior: 'EN_PROCESO',
      estadoNuevo: 'TERMINADO',
      usuarioId: usuario?.userId || null,
      usuarioNombre: usuario?.nombre || null,
      detalle: t('eventosDetalle.surtidoCompleto'),
      detalleSecundario: t('eventosDetalle.articulosSurtidos', { surt: totalSurtido, req: totalRequerido }),
    })
  }

  return NextResponse.json({ ok: true })
}

// Edición completa del pedido (admin). Preserva cantidadSurtida si el TV
// (marca, pulgadas, modelo, unidad) sigue existiendo en la nueva versión.
export async function PUT(req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const { numeroPedido, pedidoNombre, condiciones, televisiones, fechaLimite, cantidadTotal } = body

  if (typeof numeroPedido !== 'string' || !numeroPedido.trim()) {
    return NextResponse.json({ error: t('pedidoForm.numeroFalta') }, { status: 400 })
  }
  if (typeof pedidoNombre !== 'string' || !pedidoNombre.trim()) {
    return NextResponse.json({ error: t('pedidoForm.nombreFalta') }, { status: 400 })
  }
  if (!Array.isArray(condiciones) || condiciones.some((c) => !CONDICIONES.includes(c))) {
    return NextResponse.json({ error: t('apiPedidos.condicionesInvalidas') }, { status: 400 })
  }
  if (!Array.isArray(televisiones) || televisiones.length === 0) {
    return NextResponse.json({ error: t('pedidoForm.agregaAlMenos') }, { status: 400 })
  }

  if (typeof fechaLimite !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)) {
    return NextResponse.json({ error: t('pedidoForm.fechaFalta') }, { status: 400 })
  }

  let cantidadTotalLimpia = null
  if (cantidadTotal !== null && cantidadTotal !== undefined && cantidadTotal !== '') {
    const n = Number(cantidadTotal)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: t('apiPedidos.cantidadTotalInvalida') }, { status: 400 })
    }
    cantidadTotalLimpia = n
  }

  const db = await getDb()
  const existing = await db.collection('pedidos').findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        televisiones: 1, numeroPedido: 1, pedidoNombre: 1, condiciones: 1,
        fechaLimite: 1, cantidadTotal: 1, metasGrupo: 1,
      },
    }
  )
  if (!existing) {
    return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
  }
  const tvsExistentes = existing.televisiones || []

  const tvsLimpias = []
  for (const [i, tv] of televisiones.entries()) {
    if (!marcaValida(tv.marca)) {
      return NextResponse.json({ error: t('pedidoForm.marcaInvalida', { n: i + 1 }) }, { status: 400 })
    }
    const marca = normalizarMarca(tv.marca.trim().replace(/\s+/g, ' '))
    const pulgadas = Number(tv.pulgadas)
    if (!PULGADAS.includes(pulgadas)) {
      return NextResponse.json({ error: t('pedidoForm.pulgadasInvalidas', { n: i + 1 }) }, { status: 400 })
    }
    if (!Array.isArray(tv.condiciones) || tv.condiciones.length === 0 || tv.condiciones.some((c) => !CONDICIONES.includes(c))) {
      return NextResponse.json({ error: t('pedidoForm.faltaCondicion', { n: i + 1 }) }, { status: 400 })
    }
    const unidad = UNIDADES.includes(tv.unidad) ? tv.unidad : 'pieza'
    const modelo = typeof tv.modelo === 'string' ? tv.modelo.trim().toUpperCase() : ''
    if (!SKU_REGEX.test(modelo)) {
      return NextResponse.json(
        { error: t('pedidoForm.capturaModelo', { n: i + 1 }) },
        { status: 400 }
      )
    }

    const condicionesLimpias = [...new Set(tv.condiciones)]

    // Preservar cantidadSurtida si hay match exacto de SKU + condiciones
    // (marca+pulgadas+modelo+unidad+condiciones, comparadas como conjunto).
    // Dos partidas del mismo SKU con un conjunto de condiciones distinto se
    // tratan como líneas independientes.
    const matching = tvsExistentes.find(
      (v) =>
        normalizarMarca((v.marca || '').trim()) === marca &&
        v.pulgadas === pulgadas &&
        (v.modelo || '') === modelo &&
        (v.unidad || 'pieza') === unidad &&
        condicionKey(v) === [...condicionesLimpias].sort().join(',')
    )
    const cantidadSurtida = matching?.cantidadSurtida || 0

    // SKUs alternativos (cualquiera de ellos sirve para este mismo renglón).
    // Campo opcional/aditivo: se limpia igual que el SKU principal y se
    // descartan silenciosamente los que no sean válidos.
    const modelosAlternativos = Array.isArray(tv.modelosAlternativos)
      ? tv.modelosAlternativos
          .map((m) => (typeof m === 'string' ? m.trim().toUpperCase() : ''))
          .filter((m) => SKU_REGEX.test(m) && m !== modelo)
      : []

    // La meta/cantidad ya no se captura por SKU (le pertenece al grupo
    // marca+pulgadas, ver metasGrupo) — cantidad queda en 0 y sinLimite
    // siempre true; solo cantidadSurtida (el progreso real) se preserva.
    tvsLimpias.push({
      marca,
      pulgadas,
      condiciones: condicionesLimpias,
      modelo,
      modelosAlternativos,
      cantidad: 0,
      unidad,
      sinLimite: true,
      cantidadSurtida,
    })
  }

  let metasGrupoLimpias = {}
  if (body.groupTargets !== null && body.groupTargets !== undefined) {
    if (typeof body.groupTargets !== 'object' || Array.isArray(body.groupTargets)) {
      return NextResponse.json({ error: t('apiPedidos.metasGrupoInvalidas') }, { status: 400 })
    }
    for (const [key, valor] of Object.entries(body.groupTargets)) {
      if (isRequestedQuantityDefined(valor)) {
        const n = Number(valor)
        if (!Number.isInteger(n) || n < 0) {
          return NextResponse.json({ error: t('apiPedidos.metasGrupoInvalidas') }, { status: 400 })
        }
        metasGrupoLimpias[key] = n
      } else {
        metasGrupoLimpias[key] = null
      }
    }
    metasGrupoLimpias = filtrarMetasHuerfanas(metasGrupoLimpias, tvsLimpias)
  }

  if (cantidadTotalLimpia !== null) {
    const sumaMetas = Object.values(metasGrupoLimpias).reduce((s, v) => s + (isRequestedQuantityDefined(v) ? v : 0), 0)
    if (sumaMetas > cantidadTotalLimpia) {
      return NextResponse.json(
        { error: t('pedidoForm.sumaExcede', { suma: sumaMetas, limite: cantidadTotalLimpia }) },
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
        metasGrupo: metasGrupoLimpias,
        fechaLimite,
      },
    }
  )

  // Detecta qué cambió realmente para no registrar un evento vacío cuando el
  // usuario solo reabre y guarda sin tocar nada.
  const cambios = []
  if (existing.fechaLimite !== fechaLimite) cambios.push(t('eventosDetalle.fechaLimiteModificada'))
  const condicionesAntes = [...(existing.condiciones || [])].sort().join(',')
  const condicionesDespues = [...condiciones].sort().join(',')
  if (condicionesAntes !== condicionesDespues) cambios.push(t('eventosDetalle.condicionesActualizadas'))
  if ((existing.numeroPedido || '') !== numeroPedido.trim()) cambios.push(t('eventosDetalle.numeroPedidoActualizado'))
  if ((existing.pedidoNombre || '') !== pedidoNombre.trim()) cambios.push(t('eventosDetalle.nombreActualizado'))

  // El progreso solicitado ahora vive en metasGrupo (por grupo), no en
  // tv.cantidad (siempre 0 en el nuevo modelo) — la suma de metas definidas
  // es lo que hay que comparar para detectar un cambio real de cantidades.
  const sumaMetasDe = (metas) =>
    Object.values(metas || {}).reduce((s, v) => s + (isRequestedQuantityDefined(v) ? v : 0), 0)
  const sumaAntes = sumaMetasDe(existing.metasGrupo)
  const sumaDespues = sumaMetasDe(metasGrupoLimpias)
  const cambioCantidades = sumaAntes !== sumaDespues
  const mismasLineas =
    tvsExistentes.length === tvsLimpias.length &&
    tvsExistentes.every((v, i) =>
      normalizarMarca((v.marca || '').trim()) === tvsLimpias[i].marca &&
      v.modelo === tvsLimpias[i].modelo &&
      condicionKey(v) === condicionKey(tvsLimpias[i])
    )

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
        detalle: esSoloCantidades ? t('eventosDetalle.cantidadesModificadas') : (cambios[0] || t('eventosDetalle.pedidoEditado')),
        detalleSecundario: esSoloCantidades
          ? t('eventosDetalle.deAaBPiezas', { antes: sumaAntes, despues: sumaDespues })
          : (cambios.length > 1 ? cambios.slice(1).join(' · ') : (cambioCantidades ? t('eventosDetalle.cantidadesDeAaB', { antes: sumaAntes, despues: sumaDespues }) : null)),
      }
    )
  }

  return NextResponse.json({ ok: true })
}
