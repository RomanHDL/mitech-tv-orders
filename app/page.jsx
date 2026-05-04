'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MARCAS, PULGADAS, CONDICIONES } from '@/lib/catalogos'
import { IconAlert, IconArrowRight, IconClose, IconPlus } from './components/icons'

const tvVacia = () => ({ marca: '', pulgadas: '', modelo: '', cantidad: 1 })

export default function FormularioPage() {
  const router = useRouter()
  const [pedidoNombre, setPedidoNombre] = useState('')
  const [condiciones, setCondiciones] = useState([])
  const [tvs, setTvs] = useState([tvVacia()])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const totalUnidades = useMemo(
    () => tvs.reduce((s, tv) => s + (Number(tv.cantidad) || 0), 0),
    [tvs]
  )
  const marcasUnicas = useMemo(
    () => new Set(tvs.map((tv) => tv.marca).filter(Boolean)).size,
    [tvs]
  )

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
    <main className="page">
      <div className="page-header">
        <h1>Nuevo pedido</h1>
        <p className="subtitle">Captura las TVs que se incluyen en este pedido.</p>
      </div>

      <div className="card">
        <form onSubmit={enviar}>
          <div className="section">
            <label className="label" htmlFor="pedidoNombre">Nombre del pedido</label>
            <input
              id="pedidoNombre"
              type="text"
              value={pedidoNombre}
              onChange={(e) => setPedidoNombre(e.target.value)}
              placeholder="Ej. Pedido Jesica"
              required
            />
          </div>

          <div className="section">
            <div className="label">
              Condiciones
              <span className="label-help">selecciona las que apliquen</span>
            </div>
            <div className="condiciones">
              {CONDICIONES.map((c) => (
                <label
                  key={c}
                  className={`condicion-chip ${condiciones.includes(c) ? 'activa' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={condiciones.includes(c)}
                    onChange={() => toggleCondicion(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Televisiones</h2>
              <span className="count">
                {tvs.length} {tvs.length === 1 ? 'agregada' : 'agregadas'}
              </span>
            </div>

            <datalist id="marcas-list">
              {MARCAS.map((m) => <option key={m} value={m} />)}
            </datalist>

            {tvs.map((tv, i) => (
              <div key={i} className="tv-card">
                <div className="tv-card-header">
                  <span className="tv-card-num">TV #{i + 1}</span>
                  {tvs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarTv(i)}
                      className="btn btn-ghost btn-sm"
                      aria-label="Quitar TV"
                    >
                      <IconClose width={14} height={14} />
                      Quitar
                    </button>
                  )}
                </div>
                <div className="tv-card-grid">
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
                    placeholder="Cant."
                    required
                  />
                </div>
              </div>
            ))}

            <button type="button" onClick={agregarTv} className="btn-agregar-tv">
              <IconPlus />
              Agregar televisión
            </button>
          </div>

          {totalUnidades > 0 && (
            <div className="resumen-pedido">
              <div className="resumen-item">
                <div className="resumen-numero">{tvs.length}</div>
                <div className="resumen-etiqueta">Modelos</div>
              </div>
              <div className="resumen-item">
                <div className="resumen-numero">{marcasUnicas}</div>
                <div className="resumen-etiqueta">Marcas</div>
              </div>
              <div className="resumen-item">
                <div className="resumen-numero">{totalUnidades}</div>
                <div className="resumen-etiqueta">TVs totales</div>
              </div>
            </div>
          )}

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
            {enviando ? 'Enviando…' : (
              <>
                Crear pedido
                <IconArrowRight />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
