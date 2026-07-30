import { NextResponse } from 'next/server'
import { getColeccionesCubicaje } from '@/lib/integration-cubicaje-db'
import {
  compararSecretoEnTiempoConstante,
  procesarPalletCubicaje,
  sanitizarMensajeError,
  validarPayloadPallet,
} from '@/lib/integration-cubicaje'

// Endpoint máquina-a-máquina: Cubicaje es el único emisor. No depende de
// cookies de sesión humana (ver excepción exacta en middleware.js) — la
// autenticación es un secreto compartido en el header X-Integration-Key.
// Requiere Node runtime (no Edge) por crypto.timingSafeEqual.
export const runtime = 'nodejs'

// Solo se exporta POST a propósito: cualquier otro método (GET/PUT/PATCH/
// DELETE) a esta misma ruta recibe el 405 Method Not Allowed automático
// de Next.js App Router para métodos sin handler exportado — no se agregan
// handlers vacíos para esos métodos (ver __tests__/cubicaje-pallets-route.test.js).

const MAX_BODY_BYTES = 256 * 1024

export async function POST(req) {
  const claveRecibida = req.headers.get('x-integration-key')
  const claveEsperada = process.env.CUBICAJE_PEDIDOS_INTEGRATION_KEY

  if (!claveEsperada || !compararSecretoEnTiempoConstante(claveRecibida, claveEsperada)) {
    return NextResponse.json({ status: 'rechazado', detalle: 'No autorizado' }, { status: 401 })
  }

  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { status: 'rechazado', detalle: 'Payload excede el tamaño máximo permitido' },
      { status: 413 }
    )
  }

  let texto
  try {
    texto = await req.text()
  } catch {
    return NextResponse.json(
      { status: 'rechazado', detalle: 'No se pudo leer el cuerpo de la solicitud' },
      { status: 400 }
    )
  }

  if (Buffer.byteLength(texto, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json(
      { status: 'rechazado', detalle: 'Payload excede el tamaño máximo permitido' },
      { status: 413 }
    )
  }

  let body
  try {
    body = JSON.parse(texto)
  } catch {
    return NextResponse.json({ status: 'rechazado', detalle: 'JSON inválido' }, { status: 400 })
  }

  const validacion = validarPayloadPallet(body)
  if (!validacion.ok) {
    return NextResponse.json(
      { status: 'rechazado', detalle: validacion.error },
      { status: validacion.status }
    )
  }

  try {
    const colecciones = await getColeccionesCubicaje()
    const resultado = await procesarPalletCubicaje(colecciones, validacion.value)
    return NextResponse.json(resultado.body, { status: resultado.status })
  } catch (err) {
    // Nunca reflejar el error real de Mongo/infra al cliente, ni loguear
    // una posible cadena de conexión/credenciales que venga en err.message.
    console.error('[integrations/cubicaje/pallets] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json(
      { status: 'rechazado', detalle: 'Error interno al procesar el pallet' },
      { status: 500 }
    )
  }
}
