// Guardia de rutas del lado cliente — solo UX (redirige y evita el parpadeo
// de una pantalla que no corresponde). La frontera de seguridad real es el
// server (apiAuthGate + requireRole en cada ruta /api/*), no este componente.
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/use-auth'
import { homeDelRol } from '@/lib/roles'
import type { Rol } from '@shared/schema'

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Rol[]
  children: React.ReactNode
}) {
  const { usuario, cargando } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (cargando) return
    if (!usuario) {
      setLocation('/login')
      return
    }
    if (roles && !roles.includes(usuario.rol)) {
      setLocation(homeDelRol(usuario.rol))
    }
  }, [cargando, usuario, roles, setLocation])

  if (cargando || !usuario) return null
  if (roles && !roles.includes(usuario.rol)) return null

  return <>{children}</>
}
