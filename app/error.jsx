'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="centro-mensaje">
      <h1>Ocurrió un error</h1>
      <p>{error?.message || 'Algo salió mal. Intenta de nuevo.'}</p>
      <button onClick={reset} className="btn-enviar">Reintentar</button>
    </main>
  )
}
