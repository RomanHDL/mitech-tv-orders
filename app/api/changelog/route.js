import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { requireModule } from '@/lib/auth'
import { CHANGELOG_CATEGORIAS, CHANGELOG_PRIORIDADES, versionValida } from '@/lib/changelog'

export async function GET() {
  const db = await getDb()
  const entradas = await db.collection('changelog_entries').find({}).sort({ publicadoEn: -1 }).toArray()
  return NextResponse.json({
    entradas: entradas.map((e) => ({ ...e, _id: e._id.toString() })),
  })
}

// Crear entradas es una acción administrativa: el módulo 'changelog' también
// da acceso de solo lectura a capturista/surtidor, así que aquí se exige
// además el rol admin.
export async function POST(req) {
  const chk = await requireModule('changelog')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })
  if (chk.usuario.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { version, titulo, categoria, prioridad, items } = body

  if (!versionValida(version)) {
    return NextResponse.json({ error: 'Usa formato semver: x.y.z' }, { status: 400 })
  }
  if (typeof titulo !== 'string' || !titulo.trim()) {
    return NextResponse.json({ error: 'Falta el título' }, { status: 400 })
  }
  if (!CHANGELOG_CATEGORIAS.includes(categoria)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }
  if (!CHANGELOG_PRIORIDADES.includes(prioridad)) {
    return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 })
  }
  const itemsLimpios = Array.isArray(items)
    ? items.map((i) => String(i).trim()).filter(Boolean)
    : []

  const db = await getDb()
  const versionLimpia = version.trim()
  const existente = await db.collection('changelog_entries').findOne({ version: versionLimpia })
  if (existente) {
    return NextResponse.json({ error: `Ya existe una entrada con la versión ${versionLimpia}` }, { status: 400 })
  }

  const result = await db.collection('changelog_entries').insertOne({
    version: versionLimpia,
    titulo: titulo.trim(),
    categoria,
    prioridad,
    items: itemsLimpios,
    publicadoEn: new Date(),
  })

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
