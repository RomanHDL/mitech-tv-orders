// Login híbrido: OIDC Nextcloud (admin/capturista, redirect de página
// completa) + NFC/PIN (surtidor, sin fricción de SSO en piso). Reemplaza
// app/login/login-cliente.jsx del app original.
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/use-auth'
import { homeDelRol } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import LanguageSwitcher from '@/components/language-switcher'
import { ApiError } from '@/lib/queryClient'

export default function Login() {
  const { usuario, cargando, loginOidc, loginNfc, loginPin } = useAuth()
  const [, setLocation] = useLocation()
  const { t } = useTranslation()

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
      setError(t('login.pinInvalido'))
      return
    }
    setEnviando(true)
    try {
      await loginPin({ email: email.trim() || undefined, pin: pin.trim() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.errorSesion'))
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
          // El UID es el serial de hardware del tag (event.serialNumber) —
          // el mismo valor que /admin/usuarios captura con "Escanear tag" y
          // guarda en usuarios.nfcUid. A diferencia del app original (que
          // codificaba "email|pin" como contenido NDEF del tag), aquí no
          // hace falta escribir nada en el tag: basta con vincular su
          // serial a la cuenta una vez.
          const uid = event.serialNumber || ''
          if (!uid) {
            setError(t('login.nfcSinSerial'))
            return
          }
          await loginNfc(uid)
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t('login.errorNfc'))
        } finally {
          setEscaneando(false)
        }
      }
    } catch {
      setError(t('login.nfcSinPermiso'))
      setEscaneando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="mb-3 flex justify-center">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t('app.nombre')}</CardTitle>
          <CardDescription>{t('app.descripcion')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="piso">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oficina">{t('login.oficina')}</TabsTrigger>
              <TabsTrigger value="piso">{t('login.piso')}</TabsTrigger>
            </TabsList>

            <TabsContent value="oficina" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">{t('login.oficinaDescripcion')}</p>
              <Button className="w-full" onClick={loginOidc}>
                {t('login.entrarNextcloud')}
              </Button>
            </TabsContent>

            <TabsContent value="piso" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">{t('login.pisoDescripcion')}</p>

              {nfcDisponible && (
                <Button className="w-full" variant="secondary" onClick={handleNfcScan} disabled={escaneando}>
                  {escaneando ? t('login.acercaTag') : t('login.tocarTagNfc')}
                </Button>
              )}
              {!nfcDisponible && <p className="text-xs text-muted-foreground">{t('login.nfcNoDisponible')}</p>}

              <form onSubmit={handlePinSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email">{t('login.emailOpcional')}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pin">{t('login.pin')}</Label>
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
                  {enviando ? t('login.entrando') : t('login.entrarConPin')}
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
