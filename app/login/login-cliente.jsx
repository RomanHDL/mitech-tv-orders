'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IconAlert } from '../components/icons'

export default function LoginCliente() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  const enviarPin = async (valor) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: valor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'PIN incorrecto')
      }
      const { rol } = await res.json()
      const home = rol === 'surtidor' ? '/surtir' : rol === 'capturista' ? '/' : '/pedidos'
      router.push(home)
      router.refresh()
    } catch (err) {
      setError(err.message)
      setLoading(false)
      setScanning(false)
    }
  }

  const escanearNfc = async () => {
    setError('')
    setScanning(true)
    try {
      const reader = new window.NDEFReader()
      await reader.scan()

      reader.addEventListener(
        'reading',
        (event) => {
          const decoder = new TextDecoder()
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              const texto = decoder.decode(record.data).trim()
              if (texto) {
                enviarPin(texto)
                return
              }
            }
          }
          setError('Tag NFC sin información válida')
          setScanning(false)
        },
        { once: true }
      )

      reader.addEventListener('readingerror', () => {
        setError('Error al leer el tag NFC')
        setScanning(false)
      })
    } catch (err) {
      setError(`No se pudo iniciar el escaneo: ${err.message}`)
      setScanning(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!pin.trim()) return
    enviarPin(pin)
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <span className="login-logo-icon">MT</span>
        </div>
        <h1 className="login-titulo">MiTech Pedidos</h1>
        <p className="login-subtitulo">Inicia sesión para continuar</p>

        {nfcSoportado && (
          <button
            type="button"
            onClick={escanearNfc}
            disabled={scanning || loading}
            className="btn btn-primary btn-large login-btn-nfc"
          >
            {scanning ? 'Acerca tu tag NFC…' : 'Escanear tag NFC'}
          </button>
        )}

        {nfcSoportado && (
          <div className="login-divider">
            <span>o</span>
          </div>
        )}

        <form onSubmit={submit} className="login-form">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN de acceso"
            autoComplete="current-password"
            disabled={loading || scanning}
            inputMode="numeric"
          />
          <button
            type="submit"
            className="btn btn-secondary btn-large"
            disabled={loading || scanning || !pin.trim()}
          >
            {loading ? 'Verificando…' : 'Entrar con PIN'}
          </button>
        </form>

        {error && (
          <div className="alerta alerta-error">
            <IconAlert />
            <span>{error}</span>
          </div>
        )}

        {!nfcSoportado && (
          <p className="login-hint">
            NFC no disponible en este dispositivo. Usa el PIN.
          </p>
        )}
      </div>
    </main>
  )
}
