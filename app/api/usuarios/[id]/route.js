import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { emailValido, normalizarEmail, normalizarUid, pinValido, requireModule } from '@/lib/auth'
import { sanearModulos } from '@/lib/modulos'
import { getServerT } from '@/lib/i18n-server'

const ROLES = ['admin', 'capturista', 'surtidor']

// Un usuario "admin con acceso a Usuarios" es un admin cuyo allowedModules
// incluye 'users', o que todavía no tiene allowedModules asignado (en cuyo
// caso el default de admin — todos los módulos — le da acceso implícito).
// Se usa tanto para bloquear el autobloqueo como el borrado/edición de otros.
async function contarAdminsConAccesoUsuarios(db, excludeId) {
  return db.collection('usuarios').countDocuments({
    rol: 'admin',
    _id: { $ne: excludeId },
    $or: [
      { allowedModules: 'users' },
      { allowedModules: { $exists: false } },
      { allowedModules: { $size: 0 } },
    ],
  })
}

function tieneAccesoUsuarios(doc) {
  return doc.rol === 'admin' && (!Array.isArray(doc.allowedModules) || doc.allowedModules.length === 0 || doc.allowedModules.includes('users'))
}

export async function PATCH(req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('users')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

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

  const db = await getDb()
  const actual = await db.collection('usuarios').findOne({ _id: new ObjectId(id) })
  if (!actual) {
    return NextResponse.json({ error: t('usuarios.usuarioNoEncontrado') }, { status: 404 })
  }

  const $set = {}
  const $unset = {}

  if ('nombre' in body) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (!nombre) return NextResponse.json({ error: t('usuarios.errorFaltaNombre') }, { status: 400 })
    $set.nombre = nombre
  }

  if ('rol' in body) {
    if (!ROLES.includes(body.rol)) {
      return NextResponse.json({ error: t('usuarios.rolInvalido') }, { status: 400 })
    }
    $set.rol = body.rol
  }

  if ('email' in body) {
    const email = typeof body.email === 'string' ? normalizarEmail(body.email) : ''
    if (email && !emailValido(email)) {
      return NextResponse.json({ error: t('usuarios.errorEmailInvalido') }, { status: 400 })
    }
    if (email) $set.email = email
    else $unset.email = ''
  }

  if ('pin' in body) {
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (pin && !pinValido(pin)) {
      return NextResponse.json(
        { error: t('usuarios.errorPinCorto') },
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

  if ('allowedModules' in body) {
    const allowedModules = sanearModulos(body.allowedModules)
    if (allowedModules.length === 0) {
      return NextResponse.json({ error: t('usuarios.debeSeleccionarModulo') }, { status: 400 })
    }
    $set.allowedModules = allowedModules
  }

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return NextResponse.json({ error: t('usuarios.nadaQueActualizar') }, { status: 400 })
  }

  // Invariante: nunca debe quedar el sistema sin ningún admin con acceso a
  // Usuarios. Si este usuario hoy tiene ese acceso y el cambio se lo quitaría
  // (cambio de rol o remoción explícita de 'users'), verificar que quede
  // al menos otro admin con acceso antes de permitirlo.
  const tendraAccesoDespues = (() => {
    const rolFinal = $set.rol ?? actual.rol
    if (rolFinal !== 'admin') return false
    const modulosFinales = $set.allowedModules ?? actual.allowedModules
    return !Array.isArray(modulosFinales) || modulosFinales.length === 0 || modulosFinales.includes('users')
  })()

  if (tieneAccesoUsuarios(actual) && !tendraAccesoDespues) {
    const otros = await contarAdminsConAccesoUsuarios(db, new ObjectId(id))
    if (otros === 0) {
      return NextResponse.json(
        { error: t('usuarios.noQuitarAcceso') },
        { status: 400 }
      )
    }
  }

  // Verificar duplicados (email/nfcUid únicos)
  if ($set.email) {
    const dup = await db.collection('usuarios').findOne({
      email: $set.email,
      _id: { $ne: new ObjectId(id) },
    })
    if (dup) return NextResponse.json({ error: t('usuarios.emailYaExisteOtro') }, { status: 400 })
  }
  if ($set.nfcUid) {
    const dup = await db.collection('usuarios').findOne({
      nfcUid: $set.nfcUid,
      _id: { $ne: new ObjectId(id) },
    })
    if (dup) return NextResponse.json({ error: t('usuarios.nfcYaExisteOtro') }, { status: 400 })
  }

  const ops = {}
  if (Object.keys($set).length > 0) ops.$set = $set
  if (Object.keys($unset).length > 0) ops.$unset = $unset

  const result = await db.collection('usuarios').updateOne({ _id: new ObjectId(id) }, ops)
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: t('usuarios.usuarioNoEncontrado') }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req, { params }) {
  const t = await getServerT()
  const chk = await requireModule('users')
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status })

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  if (chk.usuario.userId === id) {
    return NextResponse.json({ error: t('usuarios.noEliminarPropiaCuenta') }, { status: 400 })
  }

  const db = await getDb()
  const objectId = new ObjectId(id)
  const actual = await db.collection('usuarios').findOne({ _id: objectId })
  if (!actual) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }

  if (tieneAccesoUsuarios(actual)) {
    const otros = await contarAdminsConAccesoUsuarios(db, objectId)
    if (otros === 0) {
      return NextResponse.json(
        { error: t('usuarios.noEliminarUltimoAdmin') },
        { status: 400 }
      )
    }
  }

  const result = await db.collection('usuarios').deleteOne({ _id: objectId })
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
