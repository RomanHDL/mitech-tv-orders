// Login híbrido: OIDC Nextcloud (admin/capturista, redirect de página
// completa) + NFC/PIN (surtidor, sin fricción de SSO en piso). Reemplaza
// app/login/login-cliente.jsx del app original.
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/use-auth'
import { homeDelRol } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ApiError } from '@/lib/queryClient'

export default function Login() {
  const { usuario, cargando, loginOidc, loginNfc, loginPin } = useAuth()
  const [, setLocation] = useLocation()

  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [nfcDisponible, setNfcDisponible] = useState(false)
  const [escaneando, setEscaneando] = useState(false)

  useEffect(() => {
    if (usuario) setLocation(homeDelRol(usuario.rol))
  }, [usuario, setLocation])

  useEffect(() => {
    setNfcDisponible('NDEFReader' in window)
  }, [])

  if (cargando) return null

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{6,}$/.test(pin.trim())) {
      setError('El PIN debe ser mínimo 6 dígitos numéricos')
      return
    }
    setEnviando(true)
    try {
      await loginPin({ email: email.trim() || undefined, pin: pin.trim() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  async function handleNfcScan() {
    setError('')
    setEscaneando(true)
    try {
      // @ts-expect-error — Web NFC (NDEFReader) no está en los tipos de TS por defecto.
      const reader = new NDEFReader()
      await reader.scan()
      reader.onreading = async (event: any) => {
        try {
          let uid = ''
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder(record.encoding || 'utf-8')
              const texto = decoder.decode(record.data)
              uid = texto.split('|')[0]?.trim() || texto.trim()
              break
            }
          }
          if (!uid) uid = event.serialNumber || ''
          if (!uid) {
            setError('No se pudo leer el tag NFC')
            return
          }
          await loginNfc(uid)
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión con NFC')
        } finally {
          setEscaneando(false)
        }
      }
    } catch {
      setError('No se pudo activar el lector NFC (¿permiso denegado?)')
      setEscaneando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>MiTech Pedidos</CardTitle>
          <CardDescription>Captura y surtido de pedidos de televisiones</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="piso">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oficina">Oficina</TabsTrigger>
              <TabsTrigger value="piso">Piso</TabsTrigger>
            </TabsList>

            <TabsContent value="oficina" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Admin y capturista entran con su cuenta de Nextcloud.
              </p>
              <Button className="w-full" onClick={loginOidc}>
                Entrar con Nextcloud
              </Button>
            </TabsContent>

            <TabsContent value="piso" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">Surtidor: toca tu tag NFC o captura tu PIN.</p>

              {nfcDisponible && (
                <Button className="w-full" variant="secondary" onClick={handleNfcScan} disabled={escaneando}>
                  {escaneando ? 'Acerca tu tag…' : 'Tocar tag NFC'}
                </Button>
              )}
              {!nfcDisponible && (
                <p className="text-xs text-muted-foreground">
                  NFC no disponible en este navegador — usa tu PIN.
                </p>
              )}

              <form onSubmit={handlePinSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email">Email (opcional si tu PIN es único)</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={enviando}>
                  {enviando ? 'Entrando…' : 'Entrar con PIN'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  )
}
