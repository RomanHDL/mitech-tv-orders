import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { emailValido, normalizarEmail, normalizarUid, pinValido } from '@/lib/auth'

const ROLES = ['admin', 'capturista', 'surtidor']

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

  const $set = {}
  const $unset = {}

  if ('nombre' in body) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
    $set.nombre = nombre
  }

  if ('rol' in body) {
    if (!ROLES.includes(body.rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    $set.rol = body.rol
  }

  if ('email' in body) {
    const email = typeof body.email === 'string' ? normalizarEmail(body.email) : ''
    if (email && !emailValido(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (email) $set.email = email
    else $unset.email = ''
  }

  if ('pin' in body) {
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (pin && !pinValido(pin)) {
      return NextResponse.json(
        { error: 'PIN debe ser mínimo 6 dígitos numéricos' },
        { status: 400 }
      )
    }
    if (pin) $set.pin = pin
    else $unset.pin = ''
  }

  if ('nfcUid' in body) {
    const nfcUid = typeof body.nfcUid === 'string' ? normalizarUid(body.nfcUid) : ''
    if (nfcUid) $set.nfcUid = nfcUid
    else $unset.nfcUid = ''
  }

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const db = await getDb()

  // Verificar duplicados (email/nfcUid únicos)
  if ($set.email) {
    const dup = await db.collection('usuarios').findOne({
      email: $set.email,
      _id: { $ne: new ObjectId(id) },
    })
    if (dup) return NextResponse.json({ error: 'Ya existe otro usuario con ese email' }, { status: 400 })
  }
  if ($set.nfcUid) {
    const dup = await db.collection('usuarios').findOne({
      nfcUid: $set.nfcUid,
      _id: { $ne: new ObjectId(id) },
    })
    if (dup) return NextResponse.json({ error: 'Ya existe otro usuario con ese tag NFC' }, { status: 400 })
  }

  const ops = {}
  if (Object.keys($set).length > 0) ops.$set = $set
  if (Object.keys($unset).length > 0) ops.$unset = $unset

  const result = await db.collection('usuarios').updateOne({ _id: new ObjectId(id) }, ops)
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  const db = await getDb()
  const result = await db.collection('usuarios').deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
