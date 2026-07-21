import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { emailValido, normalizarEmail, normalizarUid, pinValido, requireModule } from '@/lib/auth'
import { DEFAULT_MODULOS_POR_ROL, sanearModulos } from '@/lib/modulos'

const ROLES = ['admin', 'capturista', 'surtidor']

export async function GET() {
  const chk = await requireModule('users')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({})
    .sort({ creado: -1 })
    .toArray()

  // Migración perezosa: cualquier usuario sin allowedModules recibe el
  // default de su rol y se persiste — nunca se pisa uno que ya exista.
  const resultado = []
  for (const u of usuarios) {
    let allowedModules = sanearModulos(u.allowedModules)
    if (allowedModules.length === 0) {
      allowedModules = DEFAULT_MODULOS_POR_ROL[u.rol] || []
      await db.collection('usuarios').updateOne({ _id: u._id }, { $set: { allowedModules } })
    }
    resultado.push({
      id: u._id.toString(),
      email: u.email || '',
      nombre: u.nombre || '',
      rol: u.rol,
      tienePin: Boolean(u.pin),
      tieneNfc: Boolean(u.nfcUid),
      nfcUid: u.nfcUid || '',
      allowedModules,
      creado: u.creado ? new Date(u.creado).toISOString() : null,
    })
  }

  return NextResponse.json(resultado)
}

export async function POST(req) {
  const chk = await requireModule('users')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

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

  // Módulos permitidos: siempre se sanean contra la whitelist real (nunca
  // se confía en lo que llegue del cliente). Si no mandan nada, se usa el
  // default del rol; si mandan algo, debe quedar al menos un módulo.
  const modulosEnviados = sanearModulos(body.allowedModules)
  const allowedModules = modulosEnviados.length > 0
    ? modulosEnviados
    : (Array.isArray(body.allowedModules) ? [] : DEFAULT_MODULOS_POR_ROL[rol] || [])
  if (allowedModules.length === 0) {
    return NextResponse.json({ error: 'Debes seleccionar al menos un módulo' }, { status: 400 })
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

  const doc = { nombre, rol, allowedModules, creado: new Date() }
  if (email) doc.email = email
  if (pin) doc.pin = pin
  if (nfcUid) doc.nfcUid = nfcUid

  const result = await db.collection('usuarios').insertOne(doc)
  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 })
}
