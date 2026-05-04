'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MARCAS, PULGADAS, CONDICIONES } from '@/lib/catalogos'

const tvVacia = () => ({ marca: '', pulgadas: '', modelo: '', cantidad: 1 })

export default function FormularioPage() {
  const router = useRouter()
  const [pedidoNombre, setPedidoNombre] = useState('')
  const [condiciones, setCondiciones] = useState([])
  const [tvs, setTvs] = useState([tvVacia()])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const toggleCondicion = (c) =>
    setCondiciones((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )

  const updateTv = (i, campo, valor) =>
    setTvs((prev) => prev.map((tv, idx) => (idx === i ? { ...tv, [campo]: valor } : tv)))

  const agregarTv = () => setTvs((prev) => [...prev, tvVacia()])
  const eliminarTv = (i) => setTvs((prev) => prev.filter((_, idx) => idx !== i))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!pedidoNombre.trim()) return setError('Falta el nombre del pedido')
    if (tvs.length === 0) return setError('Agrega al menos una televisión')

    for (const [i, tv] of tvs.entries()) {
      if (!MARCAS.includes(tv.marca)) return setError(`TV #${i + 1}: marca inválida`)
      if (!PULGADAS.includes(Number(tv.pulgadas))) return setError(`TV #${i + 1}: pulgadas inválidas`)
      if (!Number(tv.cantidad) || Number(tv.cantidad) < 1) return setError(`TV #${i + 1}: cantidad inválida`)
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoNombre: pedidoNombre.trim(),
          condiciones,
          televisiones: tvs.map((tv) => ({
            marca: tv.marca,
            pulgadas: Number(tv.pulgadas),
            modelo: tv.modelo.trim(),
            cantidad: Number(tv.cantidad),
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al guardar')
      }
      const { id } = await res.json()
      router.push(`/pedidos/${id}/imprimir`)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <main className="form-container">
      <h1>Nuevo pedido</h1>

      <form onSubmit={enviar}>
        <label className="campo">
          <span>Nombre del pedido</span>
          <input
            type="text"
            value={pedidoNombre}
            onChange={(e) => setPedidoNombre(e.target.value)}
            placeholder="Ej. Pedido Jesica"
            required
          />
        </label>

        <fieldset className="condiciones">
          <legend>Condiciones</legend>
          {CONDICIONES.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={condiciones.includes(c)}
                onChange={() => toggleCondicion(c)}
              />
              {c}
            </label>
          ))}
        </fieldset>

        <h2>Televisiones</h2>
        <datalist id="marcas-list">
          {MARCAS.map((m) => <option key={m} value={m} />)}
        </datalist>

        {tvs.map((tv, i) => (
          <div key={i} className="tv-row">
            <span className="tv-num">#{i + 1}</span>
            <input
              list="marcas-list"
              value={tv.marca}
              onChange={(e) => updateTv(i, 'marca', e.target.value)}
              placeholder="Marca"
              required
            />
            <select
              value={tv.pulgadas}
              onChange={(e) => updateTv(i, 'pulgadas', e.target.value)}
              required
            >
              <option value="">Pulgadas</option>
              {PULGADAS.map((p) => (
                <option key={p} value={p}>{p}"</option>
              ))}
            </select>
            <input
              type="text"
              value={tv.modelo}
              onChange={(e) => updateTv(i, 'modelo', e.target.value)}
              placeholder="Modelo (opcional)"
            />
            <input
              type="number"
              min="1"
              value={tv.cantidad}
              onChange={(e) => updateTv(i, 'cantidad', e.target.value)}
              required
            />
            {tvs.length > 1 && (
              <button type="button" onClick={() => eliminarTv(i)} aria-label="Eliminar">✕</button>
            )}
          </div>
        ))}

        <button type="button" onClick={agregarTv} className="btn-agregar">
          + Agregar TV
        </button>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={enviando} className="btn-enviar">
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </form>
    </main>
  )
}
