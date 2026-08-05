'use client'

import { useEffect, useState } from 'react'
import { MARCAS } from '@/lib/catalogos'

// Cache a nivel de módulo — todos los <input list="marcas-list"> de la
// sesión comparten un solo fetch, no uno por formulario montado.
let marcasCache = null
let marcasPromise = null

function obtenerMarcas() {
  if (marcasCache) return Promise.resolve(marcasCache)
  if (!marcasPromise) {
    marcasPromise = fetch('/api/marcas', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        marcasCache = data?.marcas?.length ? data.marcas : MARCAS
        return marcasCache
      })
      .catch(() => MARCAS)
  }
  return marcasPromise
}

// Catálogo de marcas real (semilla + marcas ya usadas en otros pedidos),
// como <datalist> — el mismo input de texto libre de siempre sigue
// aceptando "agregar nueva marca" con solo escribirla; esto solo mejora
// las sugerencias. id por defecto reutilizable en Nuevo/Editar/Surtir.
export default function MarcasDatalist({ id = 'marcas-list' }) {
  const [marcas, setMarcas] = useState(MARCAS)

  useEffect(() => {
    let vivo = true
    obtenerMarcas().then((m) => { if (vivo) setMarcas(m) })
    return () => { vivo = false }
  }, [])

  return (
    <datalist id={id}>
      {marcas.map((m) => <option key={m} value={m} />)}
    </datalist>
  )
}
