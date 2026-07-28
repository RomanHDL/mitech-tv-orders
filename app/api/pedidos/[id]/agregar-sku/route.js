import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { MARCAS, PULGADAS, CONDICIONES, SKU_REGEX } from '@/lib/catalogos'
import { getUsuario, requireModule } from '@/lib/auth'
import { registrarEvento } from '@/lib/eventos'
import { calcularTotales } from '@/lib/estado-pedido'
import { getServerT } from '@/lib/i18n-server'

// Agrega un renglón de SKU no listado ("de último momento") durante el
// surtido — cubre el caso real de usar TVs de un SKU que no venía en la
// lista subida/actualizada del pedido. Se guarda como un renglón normal de
// `televisiones` (mismo shape que PUT), marcado con `esUltimoMomento: true`
// para distinguirlo visualmente, y arranca con cantidadSurtida = cantidad
// porque las piezas ya se usaron físicamente al momento de registrarlo.
// Body: { marca, pulgadas, modelo, condiciones, cantidad }
export async function POST(req, { params }) {
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

  const { marca, condiciones, cantidad } = body
  const pulgadas = Number(body.pulgadas)
  const modelo = typeof body.modelo === 'string' ? body.modelo.trim().toUpperCase() : ''
  const cantidadNum = Number(cantidad)

  if (!MARCAS.includes(marca)) {
    return NextResponse.json({ error: t('pedidoForm.marcaInvalida', { n: 1 }) }, { status: 400 })
  }
  if (!PULGADAS.includes(pulgadas)) {
    return NextResponse.json({ error: t('pedidoForm.pulgadasInvalidas', { n: 1 }) }, { status: 400 })
  }
  if (!SKU_REGEX.test(modelo)) {
    return NextResponse.json({ error: t('pedidoForm.capturaModelo', { n: 1 }) }, { status: 400 })
  }
  if (!Array.isArray(condiciones) || condiciones.length === 0 || condiciones.some((c) => !CONDICIONES.includes(c))) {
    return NextResponse.json({ error: t('pedidoForm.faltaCondicion', { n: 1 }) }, { status: 400 })
  }
  if (!Number.isInteger(cantidadNum) || cantidadNum < 1) {
    return NextResponse.json({ error: t('pedidoForm.cantidadInvalida', { n: 1 }) }, { status: 400 })
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
    return NextResponse.json({ error: t('apiPedidos.pedidoNoEncontrado') }, { status: 404 })
  }

  // Mismo criterio de autorización que el PATCH de cantidadSurtida: es la
  // misma acción de surtido, solo que agrega un renglón en vez de mover uno
  // existente.
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

  const { progresoPct: pctAntes } = calcularTotales(pedido)

  const nuevoTv = {
    marca,
    pulgadas,
    condiciones: [...new Set(condiciones)],
    modelo,
    modelosAlternativos: [],
    cantidad: cantidadNum,
    unidad: 'pieza',
    sinLimite: false,
    cantidadSurtida: cantidadNum,
    esUltimoMomento: true,
    agregadoPorNombre: usuario?.nombre || null,
    agregadoEn: new Date(),
  }

  await db.collection('pedidos').updateOne(
    { _id: new ObjectId(id) },
    { $push: { televisiones: nuevoTv } }
  )

  const televisionesDespues = [...(pedido.televisiones || []), nuevoTv]
  const { progresoPct: pctDespues, totalRequerido, totalSurtido } = calcularTotales({
    ...pedido,
    televisiones: televisionesDespues,
  })

  await registrarEvento(db, pedido, {
    tipo: 'SURTIDO',
    estadoAnterior: pctAntes >= 100 ? 'TERMINADO' : (pctAntes > 0 ? 'EN_PROCESO' : 'PENDIENTE'),
    estadoNuevo: pctDespues >= 100 ? 'TERMINADO' : 'EN_PROCESO',
    usuarioId: usuario?.userId || null,
    usuarioNombre: usuario?.nombre || null,
    detalle: t('eventosDetalle.skuUltimoMomentoAgregado', { sku: modelo, cantidad: cantidadNum }),
    detalleSecundario: t('eventosDetalle.articulosSurtidos', { surt: totalSurtido, req: totalRequerido }),
    metadata: { sku: modelo, cantidad: cantidadNum, marca, pulgadas },
  })

  return NextResponse.json({ ok: true, tv: nuevoTv, index: televisionesDespues.length - 1 })
}
