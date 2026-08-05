import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { PULGADAS, CONDICIONES, UNIDADES, SKU_REGEX, marcaValida } from '@/lib/catalogos'
import { getUsuario } from '@/lib/auth'
import { registrarEvento } from '@/lib/eventos'
import { normalizarMarca } from '@/lib/importar-pedido'
import { filtrarMetasHuerfanas, isRequestedQuantityDefined } from '@/lib/surtido-grupos'
import { getServerT } from '@/lib/i18n-server'

export async function POST(req) {
  const t = await getServerT()
  const usuario = await getUsuario()

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
    const sku = typeof tv.modelo === 'string' ? tv.modelo.trim().toUpperCase() : ''
    if (!SKU_REGEX.test(sku)) {
      return NextResponse.json(
        { error: t('pedidoForm.capturaModelo', { n: i + 1 }) },
        { status: 400 }
      )
    }
    // La meta/cantidad ya no se captura por SKU (le pertenece al grupo
    // marca+pulgadas, ver metasGrupo) — todo TV nuevo se guarda "sin límite"
    // a nivel individual; cantidad queda en 0 y no participa en ninguna suma.
    const unidad = UNIDADES.includes(tv.unidad) ? tv.unidad : 'pieza'
    // SKUs alternativos (cualquiera de ellos sirve para este mismo renglón).
    // Campo opcional/aditivo: se limpia igual que el SKU principal y se
    // descartan silenciosamente los que no sean válidos.
    const modelosAlternativos = Array.isArray(tv.modelosAlternativos)
      ? tv.modelosAlternativos
          .map((m) => (typeof m === 'string' ? m.trim().toUpperCase() : ''))
          .filter((m) => SKU_REGEX.test(m) && m !== sku)
      : []
    tvsLimpias.push({
      marca,
      pulgadas,
      condiciones: [...new Set(tv.condiciones)],
      modelo: sku,
      modelosAlternativos,
      cantidad: 0,
      unidad,
      sinLimite: true,
      cantidadSurtida: 0,
    })
  }

  // Metas por grupo (marca+pulgadas) — reemplaza la cantidad por SKU como
  // fuente real de "cuánto se solicitó". Formato: { "LG-65": 30, ... } con
  // null explícito para "por definir" (nunca 0). Se descarta cualquier
  // clave que ya no corresponda a un SKU real del pedido (metasGrupo del
  // cliente puede llegar desfasado si el usuario borró filas justo antes
  // de enviar).
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

  const db = await getDb()
  const fechaCreacion = new Date()
  const result = await db.collection('pedidos').insertOne({
    numeroPedido: numeroPedido.trim(),
    pedidoNombre: pedidoNombre.trim(),
    condiciones,
    cantidadTotal: cantidadTotalLimpia,
    televisiones: tvsLimpias,
    metasGrupo: metasGrupoLimpias,
    fecha: fechaCreacion,
    fechaLimite,
    creadoPor: usuario?.userId || null,
    creadoPorNombre: usuario?.nombre || null,
    creadoPorRol: usuario?.rol || null,
    // Estado logístico (Cargando/Listo para salida/Despachado/Cancelado).
    // null = todavía no hay ninguna acción de etapa; el estado visible se
    // deriva del progreso de surtido hasta que alguien lo avance a mano.
    estadoOperativo: null,
    historialEstados: [],
  })

  const totalTvs = tvsLimpias.length
  await registrarEvento(
    db,
    { _id: result.insertedId, numeroPedido: numeroPedido.trim(), pedidoNombre: pedidoNombre.trim(), condiciones },
    {
      tipo: 'CREACION',
      estadoAnterior: null,
      estadoNuevo: 'PENDIENTE',
      usuarioId: usuario?.userId || null,
      usuarioNombre: usuario?.nombre || null,
      detalle: t('eventosDetalle.pedidoCreado'),
      detalleSecundario: t('eventosDetalle.modelosCapturados', { count: totalTvs }),
      fecha: fechaCreacion,
    }
  )

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
