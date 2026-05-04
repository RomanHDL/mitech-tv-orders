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

// Admin inicial. Si la coleccion 'usuarios' no tiene ningun admin, este se
// inserta automaticamente la primera vez que la app accede a usuarios.
const ADMIN_INICIAL = {
  email: 'romanherrera548@gmail.com',
  pin: '121205',
  rol: 'admin',
  nombre: 'Roman',
}

let adminInicialAsegurado = false

async function asegurarAdminInicial(db) {
  if (adminInicialAsegurado) return
  const adminExistente = await db.collection('usuarios').findOne({ rol: 'admin' })
  if (!adminExistente) {
    await db.collection('usuarios').insertOne({
      ...ADMIN_INICIAL,
      email: normalizarEmail(ADMIN_INICIAL.email),
      creado: new Date(),
    })
  }
  adminInicialAsegurado = true
}

// Busca un usuario por email + PIN (login manual) o solo PIN (NFC simple).
export async function buscarUsuario(email, pin) {
  const db = await getDb()
  await asegurarAdminInicial(db)

  if (email) {
    const normalEmail = normalizarEmail(email)
    const user = await db.collection('usuarios').findOne({ email: normalEmail })
    if (user && user.pin === pin) return user
    return null
  }

  // Sin email: lookup por PIN solo. Funciona si el PIN es único.
  const matches = await db.collection('usuarios').find({ pin }).toArray()
  if (matches.length === 1) return matches[0]
  return null
}
