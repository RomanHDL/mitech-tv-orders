// Puerto adaptado de app/admin/tags/nfc-tags-cliente.jsx.
//
// Cambio de comportamiento respecto al original: el app original ESCRIBÍA
// "email|pin" como contenido NDEF de un tag en blanco, y el login leía ese
// texto. La auth híbrida de la Fase 2 ya no funciona así — /auth/nfc busca
// por el serial de hardware del tag (event.serialNumber), el mismo valor
// que el botón "Escanear tag" de /admin/usuarios guarda en usuarios.nfcUid.
// Ya no hace falta escribir nada en el tag. Esta pantalla se repropone como
// utilidad de lectura: acercar un tag y ver su serial, útil para identificar
// un tag físico antes de vincularlo a un usuario, o confirmar cuál tag
// corresponde a cuál cuenta.
import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminTags() {
  const [nfcSoportado, setNfcSoportado] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setNfcSoportado('NDEFReader' in window)
  }, [])

  async function leer() {
    setError('')
    setSerial('')
    setLeyendo(true)
    try {
      // @ts-expect-error — Web NFC (NDEFReader) no está en los tipos de TS por defecto.
      const reader = new NDEFReader()
      await reader.scan()
      reader.onreading = (event: any) => {
        setSerial(event.serialNumber || '')
        if (!event.serialNumber) setError('Este tag no expone un serial de hardware legible.')
        setLeyendo(false)
      }
    } catch {
      setError('No se pudo activar el lector NFC (¿permiso denegado?)')
      setLeyendo(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-primary">Leer tag NFC</h1>
        <p className="text-muted-foreground">Acerca un tag para ver su serial de hardware — úsalo para identificarlo antes de vincularlo a un usuario en Usuarios.</p>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        {!nfcSoportado ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              NFC solo funciona en <strong>Android con Chrome</strong> y NFC habilitado en ajustes.
            </span>
          </div>
        ) : (
          <>
            <Button onClick={leer} disabled={leyendo}>
              {leyendo ? 'Acerca un tag…' : 'Leer tag'}
            </Button>
            {serial && (
              <p className="mt-3 rounded-md border bg-secondary p-3 font-mono text-sm">{serial}</p>
            )}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
