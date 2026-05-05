'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MARCAS, PULGADAS, CONDICIONES } from '@/lib/catalogos'
import { IconAlert, IconArrowRight, IconBox, IconClose, IconPlus } from './icons'

const tvVacia = () => ({ marca: '', pulgadas: '', modelo: '', cantidad: 1, unidad: 'pieza' })

// Componente reutilizable de formulario de pedido (crear y editar).
// Recibe initialData opcional, una función onSubmit que guarda los datos,
// y opciones de presentación (titulo, submitLabel, etc).
export default function PedidoForm({
  initialData,
  onSubmit,
  titulo = 'Nuevo pedido',
  subtitulo = 'Captura las TVs que se incluyen en este pedido.',
  submitLabel = 'Crear pedido',
  cancelHref,
}) {
  const [pedidoNombre, setPedidoNombre] = useState(initialData?.pedidoNombre || '')
  const [fechaLimite, setFechaLimite] = useState(initialData?.fechaLimite || '')
  const [condiciones, setCondiciones] = useState(initialData?.condiciones || [])
  const [tvs, setTvs] = useState(
    initialData?.televisiones?.length
      ? initialData.televisiones.map((tv) => ({
          marca: tv.marca || '',
          pulgadas: tv.pulgadas !== undefined ? String(tv.pulgadas) : '',
          modelo: tv.modelo || '',
          cantidad: tv.cantidad || 1,
          unidad: tv.unidad || 'pieza',
        }))
      : [tvVacia()]
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const inputRefs = useRef([])
  const previousLength = useRef(tvs.length)

  useEffect(() => {
    if (tvs.length > previousLength.current) {
      const lastInput = inputRefs.current[tvs.length - 1]
      if (lastInput) {
        lastInput.focus()
        lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    previousLength.current = tvs.length
  }, [tvs.length])

  const totalUnidades = useMemo(
    () => tvs.reduce((s, tv) => s + (Number(tv.cantidad) || 0), 0),
    [tvs]
  )
  const marcasUnicas = useMemo(
    () => new Set(tvs.map((tv) => tv.marca).filter(Boolean)).size,
    [tvs]
  )
  const pallets = useMemo(
    () => tvs.reduce((s, tv) => s + (tv.unidad === 'pallet' ? Number(tv.cantidad) || 0 : 0), 0),
    [tvs]
  )
  const piezas = useMemo(
    () => tvs.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? Number(tv.cantidad) || 0 : 0), 0),
    [tvs]
  )

  const toggleCondicion = (c) =>
    setCondiciones((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )

  const updateTv = (i, campo, valor) =>
    setTvs((prev) => prev.map((tv, idx) => (idx === i ? { ...tv, [campo]: valor } : tv)))

  const togglePallet = (i) =>
    setTvs((prev) =>
      prev.map((tv, idx) =>
        idx === i ? { ...tv, unidad: tv.unidad === 'pallet' ? 'pieza' : 'pallet' } : tv
      )
    )

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
      await onSubmit({
        pedidoNombre: pedidoNombre.trim(),
        fechaLimite: fechaLimite || null,
        condiciones,
        televisiones: tvs.map((tv) => ({
          marca: tv.marca,
          pulgadas: Number(tv.pulgadas),
          modelo: tv.modelo.trim(),
          cantidad: Number(tv.cantidad),
          unidad: tv.unidad === 'pallet' ? 'pallet' : 'pieza',
        })),
      })
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  const hayPallets = pallets > 0

  return (
    <main className="page">
      <div className="page-header">
        <h1>{titulo}</h1>
        <p className="subtitle">{subtitulo}</p>
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
            <label className="label" htmlFor="fechaLimite">
              Fecha límite
              <span className="label-help">opcional</span>
            </label>
            <input
              id="fechaLimite"
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
          </div>

          <div className="section">
            <div className="label">Condiciones</div>
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

          <div className="section section-tvs">
            <div className="section-header">
              <h2>Televisiones</h2>
              <span className="count">
                {tvs.length} {tvs.length === 1 ? 'agregada' : 'agregadas'}
              </span>
            </div>

            <datalist id="marcas-list">
              {MARCAS.map((m) => <option key={m} value={m} />)}
            </datalist>

            {tvs.map((tv, i) => {
              const esPallet = tv.unidad === 'pallet'
              return (
                <div key={i} className={`tv-card ${esPallet ? 'es-pallet' : ''}`}>
                  <div className="tv-card-header">
                    <span className="tv-card-num">TV #{i + 1}</span>
                    <label className="tv-pallet-toggle">
                      <input
                        type="checkbox"
                        checked={esPallet}
                        onChange={() => togglePallet(i)}
                      />
                      <IconBox />
                      Pallet
                    </label>
                    {tvs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarTv(i)}
                        className="btn-quitar"
                        aria-label="Quitar TV"
                      >
                        <IconClose width={14} height={14} />
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="tv-card-grid">
                    <input
                      ref={(el) => { if (el) inputRefs.current[i] = el }}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && i === tvs.length - 1) {
                          e.preventDefault()
                          agregarTv()
                        }
                      }}
                      placeholder={esPallet ? 'Pallets' : 'Cant.'}
                      required
                    />
                  </div>
                </div>
              )
            })}

            <button type="button" onClick={agregarTv} className="btn-agregar-tv">
              <IconPlus />
              Agregar televisión
              <span className="atajo">o presiona Enter</span>
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
              {hayPallets ? (
                <>
                  <div className="resumen-item">
                    <div className="resumen-numero">{pallets}</div>
                    <div className="resumen-etiqueta">Pallets</div>
                  </div>
                  <div className="resumen-item">
                    <div className="resumen-numero">{piezas}</div>
                    <div className="resumen-etiqueta">Piezas</div>
                  </div>
                </>
              ) : (
                <div className="resumen-item">
                  <div className="resumen-numero">{piezas}</div>
                  <div className="resumen-etiqueta">TVs totales</div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <div className="form-acciones">
            {cancelHref && (
              <Link href={cancelHref} className="btn btn-secondary btn-large">
                Cancelar
              </Link>
            )}
            <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
              {enviando ? 'Guardando…' : (
                <>
                  {submitLabel}
                  <IconArrowRight />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
