// Provider de sesión: reemplaza la lectura de cookies rol/email/nombre del
// app original por una consulta a /api/auth/me (sesión Passport). Expone
// los tres métodos de login (OIDC redirect, NFC, PIN) y logout.
import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, getQueryFn } from '@/lib/queryClient'
import type { Rol } from '@shared/schema'

export type SesionUsuario = {
  id: string
  email: string | null
  nombre: string
  rol: Rol
}

type AuthContextValue = {
  usuario: SesionUsuario | null
  cargando: boolean
  loginOidc: () => void
  loginNfc: (nfcUid: string) => Promise<SesionUsuario>
  loginPin: (args: { email?: string; pin: string }) => Promise<SesionUsuario>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: usuario, isLoading } = useQuery<SesionUsuario | null>({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  })

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] })

  const nfcMutation = useMutation({
    mutationFn: async (nfcUid: string) => {
      const res = await apiRequest('POST', '/auth/nfc', { nfcUid })
      return res.json()
    },
    onSuccess: invalidar,
  })

  const pinMutation = useMutation({
    mutationFn: async (args: { email?: string; pin: string }) => {
      const res = await apiRequest('POST', '/auth/pin', args)
      return res.json()
    },
    onSuccess: invalidar,
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/auth/logout')
    },
    onSuccess: invalidar,
  })

  const value: AuthContextValue = {
    usuario: usuario ?? null,
    cargando: isLoading,
    loginOidc: () => {
      window.location.href = '/auth/login'
    },
    loginNfc: async (nfcUid) => {
      const r = await nfcMutation.mutateAsync(nfcUid)
      await invalidar()
      return r
    },
    loginPin: async (args) => {
      const r = await pinMutation.mutateAsync(args)
      await invalidar()
      return r
    },
    logout: async () => {
      await logoutMutation.mutateAsync()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
