'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IconAlert } from '../components/icons'

export default function LoginCliente() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  const enviarLogin = async ({ email: emailVal, pin: pinVal }) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, pin: pinVal }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo iniciar sesión')
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

  const validarYEnviar = async ({ email: e, pin: p }) => {
    if (!p || !/^\d{6,}$/.test(p)) {
      setError('El PIN debe ser mínimo 6 dígitos numéricos')
      return
    }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Email inválido')
      return
    }
    await enviarLogin({ email: e, pin: p })
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
              if (!texto) continue

              // Formato esperado: "email|pin" o solo "pin"
              let emailTag = ''
              let pinTag = texto
              if (texto.includes('|')) {
                const partes = texto.split('|')
                emailTag = partes[0].trim()
                pinTag = partes[1].trim()
              }
              validarYEnviar({ email: emailTag, pin: pinTag })
              return
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
    validarYEnviar({ email: email.trim(), pin: pin.trim() })
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
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              disabled={loading || scanning}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-pin">PIN</label>
            <input
              id="login-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Mínimo 6 dígitos"
              autoComplete="current-password"
              inputMode="numeric"
              pattern="\d{6,}"
              minLength={6}
              disabled={loading || scanning}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={loading || scanning || !pin.trim()}
          >
            {loading ? 'Verificando…' : 'Entrar'}
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
            NFC no disponible en este dispositivo. Usa email + PIN.
          </p>
        )}
      </div>
    </main>
  )
}
