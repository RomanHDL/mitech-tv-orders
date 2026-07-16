// Placeholder — se reemplaza en la Fase 2 (auth híbrida OIDC + NFC/PIN) por
// un provider real que consulta /api/auth/me y expone usuario/rol/logout.
import { createContext, useContext, type ReactNode } from 'react'

type AuthContextValue = {
  usuario: null
}

const AuthContext = createContext<AuthContextValue>({ usuario: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ usuario: null }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
