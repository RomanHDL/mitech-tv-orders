'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { IconAlert } from '../components/icons'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import LanguageSwitcher from '../components/language-switcher'

export default function LoginCliente() {
  const router = useRouter()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  const enviarLogin = async (body) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const validarYEnviarManual = async ({ email: e, pin: p }) => {
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
              if (texto) {
                let emailTag = ''
                let pinTag = texto
                if (texto.includes('|')) {
                  const partes = texto.split('|')
                  emailTag = partes[0].trim()
                  pinTag = partes[1].trim()
                }
                validarYEnviarManual({ email: emailTag, pin: pinTag })
                return
              }
            }
          }

          if (event.serialNumber) {
            enviarLogin({ nfcUid: event.serialNumber })
            return
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
    validarYEnviarManual({ email: email.trim(), pin: pin.trim() })
  }

  return (
    <main className="login-page">
      <aside className="login-hero">
        <div className="login-hero-blobs" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
        </div>
        <div className="login-hero-content">
          <div className="login-hero-logo">
            <img src={LOGO_MITECH} alt="MiTechnologies" width="240" height="76" />
          </div>
          <h1 className="login-hero-titulo">{t('login.heroTitulo')}</h1>
          <p className="login-hero-tagline">{t('login.heroTagline')}</p>
          <ul className="login-hero-features">
            <li>{t('login.heroFeature1')}</li>
            <li>{t('login.heroFeature2')}</li>
            <li>{t('login.heroFeature3')}</li>
          </ul>
        </div>
      </aside>

      <section className="login-form-panel">
        <div className="login-card">
          <LanguageSwitcher />
          <h2 className="login-titulo">{t('login.titulo')}</h2>
          <p className="login-subtitulo">{t('login.subtitulo')}</p>

          {nfcSoportado && (
            <button
              type="button"
              onClick={escanearNfc}
              disabled={scanning || loading}
              className={`btn btn-primary btn-large login-btn-nfc ${scanning ? 'escaneando' : ''}`}
            >
              {scanning ? t('login.escaneando') : t('login.escanear')}
            </button>
          )}

          {nfcSoportado && (
            <div className="login-divider">
              <span>{t('login.o')}</span>
            </div>
          )}

          <form onSubmit={submit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">{t('login.email')}</label>
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
              <label htmlFor="login-pin">{t('login.pin')}</label>
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
              {loading ? t('login.verificando') : t('login.entrar')}
            </button>
          </form>

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          {!nfcSoportado && (
            <p className="login-hint">{t('login.hintNfc')}</p>
          )}
        </div>
      </section>
    </main>
  )
}
