'use client'

import { useEffect } from 'react'
import { IconAlert } from './components/icons'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="centro-mensaje">
      <div className="centro-mensaje-icon">
        <IconAlert width={28} height={28} />
      </div>
      <h1>Ocurrió un error</h1>
      <p>{error?.message || 'Algo salió mal. Intenta de nuevo.'}</p>
      <button onClick={reset} className="btn btn-primary">Reintentar</button>
    </main>
  )
}
