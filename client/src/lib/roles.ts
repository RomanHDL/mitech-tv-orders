// Home por rol y labels — equivalente a homeDelRol/ROL_LABEL de lib/auth.js
// del app original.
import type { Rol } from '@shared/schema'

export function homeDelRol(rol: Rol): string {
  if (rol === 'surtidor') return '/surtir'
  if (rol === 'capturista') return '/'
  return '/pedidos' // admin
}

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Admin',
  capturista: 'Capturista',
  surtidor: 'Surtidor',
}
