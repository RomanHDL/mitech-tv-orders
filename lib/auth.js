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

// PIN: mínimo 6 dígitos numéricos
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

// Si no hay ningún admin en la base y el intento de login coincide con
// los valores de bootstrap (env vars), crea ese admin sobre la marcha.
export async function intentarBootstrap(email, pin, db) {
  const bootEmail = normalizarEmail(process.env.ADMIN_BOOTSTRAP_EMAIL)
  const bootPin = (process.env.ADMIN_BOOTSTRAP_PIN || '').trim()

  if (!bootEmail || !bootPin) return null
  if (email !== bootEmail || pin !== bootPin) return null

  const adminExistente = await db.collection('usuarios').findOne({ rol: 'admin' })
  if (adminExistente) return null

  const result = await db.collection('usuarios').insertOne({
    email: bootEmail,
    pin: bootPin,
    rol: 'admin',
    nombre: bootEmail.split('@')[0],
    creado: new Date(),
  })

  return await db.collection('usuarios').findOne({ _id: result.insertedId })
}

// Busca un usuario por email + PIN (login manual) o solo PIN (NFC simple).
export async function buscarUsuario(email, pin) {
  const db = await getDb()

  if (email) {
    const normalEmail = normalizarEmail(email)
    let user = await db.collection('usuarios').findOne({ email: normalEmail })

    // Si no existe, intentar bootstrap (puede que sea el admin inicial)
    if (!user) {
      user = await intentarBootstrap(normalEmail, pin, db)
    }

    if (user && user.pin === pin) return user
    return null
  }

  // Sin email: lookup por PIN solo. Funciona si el PIN es único.
  const matches = await db.collection('usuarios').find({ pin }).toArray()
  if (matches.length === 1) return matches[0]
  return null
}
