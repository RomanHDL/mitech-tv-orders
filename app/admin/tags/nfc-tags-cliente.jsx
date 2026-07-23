'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconCheck } from '../../components/icons'

export default function NfcTagsCliente() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [estado, setEstado] = useState('idle') // 'idle' | 'escribiendo' | 'exito' | 'error'
  const [error, setError] = useState('')
  const [nfcSoportado, setNfcSoportado] = useState(false)

  useEffect(() => {
    setNfcSoportado(typeof window !== 'undefined' && 'NDEFReader' in window)
  }, [])

  const escribir = async (e) => {
    e.preventDefault()
    setError('')

    const emailLimpio = email.trim().toLowerCase()
    const pinLimpio = pin.trim()

    if (!emailLimpio || !pinLimpio) {
      setError(t('tagsNfc.errorFaltaEmailOPin'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      setError(t('tagsNfc.errorEmailInvalido'))
      return
    }
    if (!/^\d{6,}$/.test(pinLimpio)) {
      setError(t('tagsNfc.errorPinCorto'))
      return
    }

    setEstado('escribiendo')
    try {
      const writer = new window.NDEFReader()
      await writer.write({
        records: [{ recordType: 'text', data: `${emailLimpio}|${pinLimpio}` }],
      })
      setEstado('exito')
      setTimeout(() => setEstado('idle'), 3500)
    } catch (err) {
      setEstado('error')
      setError(err.message || t('tagsNfc.errorEscribir'))
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>{t('tagsNfc.titulo')}</h1>
        <p className="subtitle">{t('tagsNfc.subtitulo')}</p>
      </div>

      <div className="card">
        {!nfcSoportado ? (
          <div className="alerta alerta-error">
            <IconAlert />
            <span>
              {t('tagsNfc.avisoNoSoportadoPre')} <strong>{t('tagsNfc.avisoNoSoportadoStrong')}</strong>{' '}
              {t('tagsNfc.avisoNoSoportadoPost')}
            </span>
          </div>
        ) : (
          <form onSubmit={escribir}>
            <div className="section">
              <label className="label" htmlFor="tag-email">{t('tagsNfc.emailUsuarioLabel')}</label>
              <input
                id="tag-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('usuarios.emailPlaceholder')}
                autoComplete="off"
                disabled={estado === 'escribiendo'}
                required
              />
            </div>

            <div className="section">
              <label className="label" htmlFor="tag-pin">{t('tagsNfc.pinLabel')}</label>
              <input
                id="tag-pin"
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t('tagsNfc.pinPlaceholder')}
                inputMode="numeric"
                pattern="\d{6,}"
                autoComplete="off"
                disabled={estado === 'escribiendo'}
                required
              />
            </div>

            {error && (
              <div className="alerta alerta-error">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            {estado === 'exito' && (
              <div className="alerta alerta-exito">
                <IconCheck />
                <span>{t('tagsNfc.tagEscrito')}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={estado === 'escribiendo' || !email.trim() || !pin.trim()}
            >
              {estado === 'escribiendo' ? t('tagsNfc.acercaTag') : t('tagsNfc.escribirTag')}
            </button>

            <p className="tag-hint">
              <strong>{t('tagsNfc.comoUsarloTitulo')}</strong> {t('tagsNfc.comoUsarloTexto')}{' '}
              <code>email|pin</code>. {t('tagsNfc.comoUsarloFinal')}
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
