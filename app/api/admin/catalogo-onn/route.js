import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { PULGADAS, SKU_REGEX } from '@/lib/catalogos'
import { getServerT } from '@/lib/i18n-server'

const COLECCION = 'catalogo_onn'

// Normaliza el código del modelo igual que el formulario (alfanum, mayúsculas).
function normalizarModelo(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
}

// GET — lista del catálogo ONN. Cualquier rol con el módulo 'onn-catalog'
// (admin lo tiene siempre por default; capturista también, para el
// autollenado de pulgadas al importar en Nuevo Pedido).
export async function GET() {
  const chk = await requireModule('onn-catalog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
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

// POST — agrega un código ONN -> pulgada. Requiere el módulo 'onn-catalog' y
// rol admin (gestionar el catálogo es una acción administrativa aparte del
// simple acceso de lectura que también da ese módulo).
export async function POST(req) {
  const t = await getServerT()
  const chk = await requireModule('onn-catalog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  if (chk.usuario.rol !== 'admin') {
    return NextResponse.json({ error: t('apiComun.noAutorizado') }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const modelo = normalizarModelo(body.modelo)
  const pulgadas = Number(body.pulgadas)

  if (!SKU_REGEX.test(modelo)) {
    return NextResponse.json({ error: t('apiCatalogoOnn.codigoInvalido') }, { status: 400 })
  }
  if (!PULGADAS.includes(pulgadas)) {
    return NextResponse.json({ error: t('apiCatalogoOnn.pulgadasInvalidas') }, { status: 400 })
  }

  const db = await getDb()
  const dup = await db.collection(COLECCION).findOne({ modelo })
  if (dup) {
    return NextResponse.json({ error: t('apiCatalogoOnn.yaExiste') }, { status: 400 })
  }

  const result = await db.collection(COLECCION).insertOne({
    modelo,
    pulgadas,
    actualizado: new Date(),
  })
  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
