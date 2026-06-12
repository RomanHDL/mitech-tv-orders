import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import { PULGADAS, SKU_REGEX } from '@/lib/catalogos'

const COLECCION = 'catalogo_onn'

// Normaliza el código del modelo igual que el formulario (alfanum, mayúsculas).
function normalizarModelo(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
}

// GET — lista del catálogo ONN. Solo admin (también para el autollenado al importar).
export async function GET() {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const db = await getDb()
  const items = await db.collection(COLECCION).find({}).sort({ modelo: 1 }).toArray()
  return NextResponse.json(
    items.map((it) => ({
      id: it._id.toString(),
      modelo: it.modelo,
      pulgadas: it.pulgadas,
    }))
  )
}

// POST — agrega un código ONN -> pulgada. Solo admin.
export async function POST(req) {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const modelo = normalizarModelo(body.modelo)
  const pulgadas = Number(body.pulgadas)

  if (!SKU_REGEX.test(modelo)) {
    return NextResponse.json({ error: 'Código de modelo inválido (3-20 letras o números)' }, { status: 400 })
  }
  if (!PULGADAS.includes(pulgadas)) {
    return NextResponse.json({ error: 'Pulgadas inválidas' }, { status: 400 })
  }

  const db = await getDb()
  const dup = await db.collection(COLECCION).findOne({ modelo })
  if (dup) {
    return NextResponse.json({ error: 'Ese modelo ya está en el catálogo' }, { status: 400 })
  }

  const result = await db.collection(COLECCION).insertOne({
    modelo,
    pulgadas,
    actualizado: new Date(),
  })
  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
