import { cookies } from 'next/headers'
import { getDb } from './mongodb'

export async function getRol() {
  const c = await cookies()
  return c.get('rol')?.value || null
}

export async function getUsuario() {
  const c = await cookies()
  const rol = c.get('rol')?.value
  if (!rol) return null
  return {
    rol,
    email: c.get('email')?.value || null,
    nombre: c.get('nombre')?.value || null,
    userId: c.get('userId')?.value || null,
  }
}

export function homeDelRol(rol) {
  if (rol === 'surtidor') return '/surtir'
  if (rol === 'capturista') return '/'
  return '/pedidos'
}

export const ROL_LABEL = {
  admin: 'Admin',
  capturista: 'Capturista',
  surtidor: 'Surtidor',
}

export function pinValido(pin) {
  return typeof pin === 'string' && /^\d{6,}$/.test(pin.trim())
}

export function emailValido(email) {
  if (typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function normalizarEmail(email) {
  return (email || '').trim().toLowerCase()
}

export function normalizarUid(uid) {
  return (uid || '').trim().toUpperCase()
}

// Usuarios iniciales hardcodeados. Se sincronizan con la coleccion 'usuarios'
// en cada cold start: si no existen se crean, si existen se actualizan los campos.
const USUARIOS_INICIALES = [
  {
    email: 'romanherrera548@gmail.com',
    pin: '121205',
    rol: 'admin',
    nombre: 'Roman',
  },
  {
    email: 'lopeznthalie@gmail.com',
    pin: '123456',
    nfcUid: '04:35:28:92:6B:1C:90',
    rol: 'surtidor',
    nombre: 'Nathalie Lopes',
  },
]

let usuariosAsegurados = false

async function asegurarUsuariosIniciales(db) {
  if (usuariosAsegurados) return

  for (const u of USUARIOS_INICIALES) {
    // Filtro por nfcUid si lo tiene, sino por email
    const filtro = u.nfcUid
      ? { nfcUid: normalizarUid(u.nfcUid) }
      : u.email
        ? { email: normalizarEmail(u.email) }
        : null

    if (!filtro) continue

    const datos = { ...u }
    if (datos.email) datos.email = normalizarEmail(datos.email)
    if (datos.nfcUid) datos.nfcUid = normalizarUid(datos.nfcUid)

    // Upsert: si existe actualiza campos, si no existe lo crea
    await db.collection('usuarios').updateOne(
      filtro,
      {
        $set: datos,
        $setOnInsert: { creado: new Date() },
      },
      { upsert: true }
    )
  }

  usuariosAsegurados = true
}

// Busca un usuario para login. Acepta:
// - { nfcUid }: login por UID del tag NFC (sin PIN)
// - { email, pin }: login manual con email + PIN
// - { pin }: login con solo PIN (si es único en el sistema)
export async function buscarUsuario({ email, pin, nfcUid } = {}) {
  const db = await getDb()
  await asegurarUsuariosIniciales(db)

  if (nfcUid) {
    return await db.collection('usuarios').findOne({ nfcUid: normalizarUid(nfcUid) })
  }

  if (email) {
    const user = await db.collection('usuarios').findOne({
      email: normalizarEmail(email),
    })
    if (user && user.pin === pin) return user
    return null
  }

  if (pin) {
    const matches = await db.collection('usuarios').find({ pin }).toArray()
    if (matches.length === 1) return matches[0]
  }

  return null
}
