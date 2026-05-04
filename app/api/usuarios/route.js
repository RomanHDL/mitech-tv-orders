import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { emailValido, normalizarEmail, normalizarUid, pinValido } from '@/lib/auth'

const ROLES = ['admin', 'capturista', 'surtidor']

export async function GET() {
  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({})
    .sort({ creado: -1 })
    .toArray()

  return NextResponse.json(
    usuarios.map((u) => ({
      id: u._id.toString(),
      email: u.email || '',
      nombre: u.nombre || '',
      rol: u.rol,
      tienePin: Boolean(u.pin),
      tieneNfc: Boolean(u.nfcUid),
      nfcUid: u.nfcUid || '',
      creado: u.creado ? new Date(u.creado).toISOString() : null,
    }))
  )
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const rol = body.rol
  const email = typeof body.email === 'string' ? normalizarEmail(body.email) : ''
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  const nfcUid = typeof body.nfcUid === 'string' ? normalizarUid(body.nfcUid) : ''

  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  }
  if (!ROLES.includes(rol)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }
  if (!email && !nfcUid) {
    return NextResponse.json(
      { error: 'Necesita al menos email+PIN o tag NFC' },
      { status: 400 }
    )
  }
  if (email && !emailValido(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (email && !pin) {
    return NextResponse.json({ error: 'Si pones email también necesita PIN' }, { status: 400 })
  }
  if (pin && !pinValido(pin)) {
    return NextResponse.json(
      { error: 'PIN debe ser mínimo 6 dígitos numéricos' },
      { status: 400 }
    )
  }

  const db = await getDb()

  if (email) {
    const dup = await db.collection('usuarios').findOne({ email })
    if (dup) return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 })
  }
  if (nfcUid) {
    const dup = await db.collection('usuarios').findOne({ nfcUid })
    if (dup) return NextResponse.json({ error: 'Ya existe un usuario con ese tag NFC' }, { status: 400 })
  }

  const doc = { nombre, rol, creado: new Date() }
  if (email) doc.email = email
  if (pin) doc.pin = pin
  if (nfcUid) doc.nfcUid = nfcUid

  const result = await db.collection('usuarios').insertOne(doc)
  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
