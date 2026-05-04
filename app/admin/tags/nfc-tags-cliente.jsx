'use client'

import { useState, useEffect } from 'react'
import { IconAlert, IconCheck } from '../../components/icons'

export default function NfcTagsCliente() {
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
      setError('Falta email o PIN')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      setError('Email inválido')
      return
    }
    if (!/^\d{6,}$/.test(pinLimpio)) {
      setError('El PIN debe ser mínimo 6 dígitos numéricos')
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
      setError(err.message || 'No se pudo escribir el tag')
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Crear tag NFC</h1>
        <p className="subtitle">
          Escribe email y PIN en un tag NFC en blanco para que el usuario entre con un toque.
        </p>
      </div>

      <div className="card">
        {!nfcSoportado ? (
          <div className="alerta alerta-error">
            <IconAlert />
            <span>
              NFC solo funciona en <strong>Android con Chrome</strong> y NFC habilitado en
              ajustes. Abre esta página desde un Android para escribir tags.
            </span>
          </div>
        ) : (
          <form onSubmit={escribir}>
            <div className="section">
              <label className="label" htmlFor="tag-email">Email del usuario</label>
              <input
                id="tag-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@correo.com"
                autoComplete="off"
                disabled={estado === 'escribiendo'}
                required
              />
            </div>

            <div className="section">
              <label className="label" htmlFor="tag-pin">PIN</label>
              <input
                id="tag-pin"
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Mínimo 6 dígitos"
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
                <span>Tag escrito. El usuario ya puede entrar acercándolo al login.</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={estado === 'escribiendo' || !email.trim() || !pin.trim()}
            >
              {estado === 'escribiendo' ? 'Acerca un tag NFC en blanco…' : 'Escribir tag'}
            </button>

            <p className="tag-hint">
              <strong>Cómo usarlo:</strong> Llena email y PIN, click "Escribir tag", luego
              acerca un tag NFC vacío al teléfono. El tag queda con el formato{' '}
              <code>email|pin</code>. Cuando ese usuario acerque su tag al login, entra
              automáticamente.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
