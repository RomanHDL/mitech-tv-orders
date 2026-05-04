import { cookies } from 'next/headers'

export async function getRol() {
  const c = await cookies()
  return c.get('rol')?.value || null
}

export function homeDelRol(rol) {
  if (rol === 'surtidor') return '/surtir'
  if (rol === 'capturista') return '/'
  return '/pedidos' // admin
}

export const ROL_LABEL = {
  admin: 'Admin',
  capturista: 'Capturista',
  surtidor: 'Surtidor',
}

// Verifica un PIN contra los configurados en variables de entorno.
// Cada variable puede tener varios PINs separados por coma.
export function rolDePin(pin) {
  if (!pin) return null
  const trimmed = pin.trim()
  if (!trimmed) return null

  const adminPins = parsePins(process.env.ADMIN_PIN)
  const capPins = parsePins(process.env.CAPTURISTA_PIN)
  const surPins = parsePins(process.env.SURTIDOR_PIN)

  if (adminPins.includes(trimmed)) return 'admin'
  if (capPins.includes(trimmed)) return 'capturista'
  if (surPins.includes(trimmed)) return 'surtidor'
  return null
}

function parsePins(value) {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}
