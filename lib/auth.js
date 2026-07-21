import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getDb } from './mongodb'
import { DEFAULT_MODULOS_POR_ROL, sanearModulos } from './modulos'

export async function getRol() {
  const c = await cookies()
  return c.get('rol')?.value || null
}

// Sesión leída de las cookies (httpOnly, no de la base de datos) — rápida,
// usada por Server Components para renderizar (nav, páginas). `allowedModules`
// viene de la cookie puesta en el login; si esa cookie falta (sesión de
// antes de esta función, o cookie corrupta) se usa el default del rol para
// no dejar a nadie sin nada que ver. Esto es solo para UI: la autorización
// real de cada acción sensible se valida aparte con requireModule(), que
// siempre relee de la base de datos.
export async function getUsuario() {
  const c = await cookies()
  const rol = c.get('rol')?.value
  if (!rol) return null

  let allowedModules = null
  const raw = c.get('allowedModules')?.value
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      allowedModules = sanearModulos(parsed)
    } catch {
      allowedModules = null
    }
  }
  if (!allowedModules || allowedModules.length === 0) {
    allowedModules = DEFAULT_MODULOS_POR_ROL[rol] || []
  }

  return {
    rol,
    email: c.get('email')?.value || null,
    nombre: c.get('nombre')?.value || null,
    userId: c.get('userId')?.value || null,
    allowedModules,
  }
}

// Verificación REAL de permiso por módulo, para usar dentro de handlers de
// API sensibles (requireModule('users'), requireModule('picking'), etc.).
// A propósito NO confía en la cookie: relee siempre el documento actual del
// usuario en Mongo, así que ni un cookie viejo/manipulado ni un cambio de
// permisos hecho por un admin mientras la otra persona ya tenía sesión
// abierta pueden saltarse el control — cada request se valida contra el
// estado real guardado.
export async function requireModule(moduloId) {
  const c = await cookies()
  const rol = c.get('rol')?.value
  const userId = c.get('userId')?.value
  if (!rol || !userId) {
    return { ok: false, status: 401, error: 'No autenticado' }
  }
  if (!ObjectId.isValid(userId)) {
    return { ok: false, status: 401, error: 'Sesión inválida' }
  }

  const db = await getDb()
  const doc = await db.collection('usuarios').findOne(
    { _id: new ObjectId(userId) },
    { projection: { allowedModules: 1, rol: 1, nombre: 1, email: 1 } }
  )
  if (!doc) {
    return { ok: false, status: 401, error: 'Usuario no encontrado' }
  }

  const permitidos =
    Array.isArray(doc.allowedModules) && doc.allowedModules.length > 0
      ? sanearModulos(doc.allowedModules)
      : DEFAULT_MODULOS_POR_ROL[doc.rol] || []

  if (!permitidos.includes(moduloId)) {
    return { ok: false, status: 403, error: 'No tienes permiso para acceder a este módulo.' }
  }

  return {
    ok: true,
    usuario: { userId, rol: doc.rol, nombre: doc.nombre || null, email: doc.email || null, allowedModules: permitidos },
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
    nfcUid: '42:3A:D4:42',
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
    // Filtro: busca por nfcUid O por email (lo que sea que coincida con un
    // registro existente). Asi al agregar un nfcUid a un user que solo tenia
    // email, lo encontramos por email y le agregamos el UID con $set.
    const filtros = []
    if (u.nfcUid) filtros.push({ nfcUid: normalizarUid(u.nfcUid) })
    if (u.email) filtros.push({ email: normalizarEmail(u.email) })
    if (filtros.length === 0) continue
    const filtro = filtros.length === 1 ? filtros[0] : { $or: filtros }

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

// Migración perezosa: si el usuario ya existía antes de que existiera
// allowedModules, se le asignan los permisos por default de su rol y se
// persiste — así nunca se queda sin acceso, y solo se completa el campo
// cuando de verdad falta (nunca se pisa un allowedModules ya guardado,
// aunque sea distinto del default de su rol).
export async function asegurarModulosUsuario(db, usuarioDoc) {
  if (Array.isArray(usuarioDoc.allowedModules) && usuarioDoc.allowedModules.length > 0) {
    return usuarioDoc
  }
  const porDefecto = DEFAULT_MODULOS_POR_ROL[usuarioDoc.rol] || []
  await db.collection('usuarios').updateOne(
    { _id: usuarioDoc._id },
    { $set: { allowedModules: porDefecto } }
  )
  return { ...usuarioDoc, allowedModules: porDefecto }
}

// Busca un usuario para login. Acepta:
// - { nfcUid }: login por UID del tag NFC (sin PIN)
// - { email, pin }: login manual con email + PIN
// - { pin }: login con solo PIN (si es único en el sistema)
export async function buscarUsuario({ email, pin, nfcUid } = {}) {
  const db = await getDb()
  await asegurarUsuariosIniciales(db)

  let user = null

  if (nfcUid) {
    user = await db.collection('usuarios').findOne({ nfcUid: normalizarUid(nfcUid) })
  } else if (email) {
    const candidato = await db.collection('usuarios').findOne({
      email: normalizarEmail(email),
    })
    if (candidato && candidato.pin === pin) user = candidato
  } else if (pin) {
    const matches = await db.collection('usuarios').find({ pin }).toArray()
    if (matches.length === 1) user = matches[0]
  }

  if (!user) return null
  return asegurarModulosUsuario(db, user)
}
