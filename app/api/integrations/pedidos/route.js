import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { compararSecretoEnTiempoConstante } from '@/lib/integration-cubicaje'

// Endpoint máquina-a-máquina de SOLO LECTURA: lista pedidos reales de este
// proyecto para otro consumidor (ej. mitechnologies-rt), sin sesión de
// usuario. Preparación 2026-08-06 — no se conecta ningún consumidor
// todavía, solo queda listo. Mismo patrón de llave compartida que el
// receptor de Cubicaje (ver app/api/integrations/cubicaje/pallets/route.js
// y la excepción exacta en middleware.js), pero con su PROPIA variable de
// entorno para poder revocarlo sin afectar esa otra integración.
// Requiere Node runtime (no Edge) por crypto.timingSafeEqual.
export const runtime = 'nodejs'

export async function GET(req) {
  const claveRecibida = req.headers.get('x-integration-key')
  const claveEsperada = process.env.MITECHNOLOGIES_INTEGRATIONS_KEY

  if (!claveEsperada) {
    return NextResponse.json({ error: 'MITECHNOLOGIES_INTEGRATIONS_KEY no configurada' }, { status: 503 })
  }
  if (!compararSecretoEnTiempoConstante(claveRecibida, claveEsperada)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))
  const skip = Math.max(0, Number(searchParams.get('skip')) || 0)

  const db = await getDb()
  const [pedidos, total] = await Promise.all([
    db.collection('pedidos').find({}).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('pedidos').estimatedDocumentCount(),
  ])

  return NextResponse.json({
    data: pedidos.map((p) => ({ ...p, _id: p._id.toString() })),
    total,
    limit,
    skip,
  })
}
