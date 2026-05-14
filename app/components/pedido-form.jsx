'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MARCAS, PULGADAS, CONDICIONES, SKU_REGEX } from '@/lib/catalogos'
import { IconAlert, IconArrowRight, IconBox, IconClose, IconPlus } from './icons'

const tvVacia = () => ({ marca: '', pulgadas: '', modelo: '', cantidad: 1, unidad: 'pieza', sinLimite: false })

export default function PedidoForm({
  initialData,
  onSubmit,
  titulo = 'Nuevo pedido',
  subtitulo = 'Captura las TVs que se incluyen en este pedido.',
  submitLabel = 'Crear pedido',
  cancelHref,
}) {
  const [numeroPedido, setNumeroPedido] = useState(initialData?.numeroPedido || '')
  const [pedidoNombre, setPedidoNombre] = useState(initialData?.pedidoNombre || '')
  const [fechaLimite, setFechaLimite] = useState(initialData?.fechaLimite || '')
  const [condiciones, setCondiciones] = useState(initialData?.condiciones || [])
  const [cantidadTotal, setCantidadTotal] = useState(
    initialData?.cantidadTotal != null && initialData?.cantidadTotal > 0
      ? String(initialData.cantidadTotal)
      : ''
  )
  const [tvs, setTvs] = useState(
    initialData?.televisiones?.length
      ? initialData.televisiones.map((tv) => ({
          marca: tv.marca || '',
          pulgadas: tv.pulgadas !== undefined ? String(tv.pulgadas) : '',
          modelo: tv.modelo || '',
          cantidad: tv.cantidad || 1,
          unidad: tv.unidad || 'pieza',
          sinLimite: Boolean(tv.sinLimite),
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

  const limite = useMemo(() => {
    const n = Number(cantidadTotal)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [cantidadTotal])

  // Una TV "Sin límite" NO suma al cupo del pedido. Visualmente muestra el
  // valor de "Cantidad total del pedido" cuando existe, pero para sumas vale 0.
  const cantidadParaSuma = (tv) => {
    if (tv.sinLimite) return 0
    return Number(tv.cantidad) || 0
  }

  const totalUnidades = useMemo(
    () => tvs.reduce((s, tv) => s + cantidadParaSuma(tv), 0),
    [tvs]
  )
  const marcasUnicas = useMemo(
    () => new Set(tvs.map((tv) => tv.marca).filter(Boolean)).size,
    [tvs]
  )
  const pallets = useMemo(
    () => tvs.reduce(
      (s, tv) => s + (tv.unidad === 'pallet' ? cantidadParaSuma(tv) : 0),
      0
    ),
    [tvs]
  )
  const piezas = useMemo(
    () => tvs.reduce(
      (s, tv) => s + (tv.unidad !== 'pallet' ? cantidadParaSuma(tv) : 0),
      0
    ),
    [tvs]
  )

  const cupoRestante = limite > 0 ? Math.max(0, limite - totalUnidades) : Infinity
  const pedidoCerrado = limite > 0 && totalUnidades >= limite
  const pedidoExcedido = limite > 0 && totalUnidades > limite

  const toggleCondicion = (c) =>
    setCondiciones((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )

  const updateTv = (i, campo, valor) =>
    setTvs((prev) => prev.map((tv, idx) => (idx === i ? { ...tv, [campo]: valor } : tv)))

  // Para cantidad: respeta el cupo restante (suma de las demás TVs vs límite).
  const updateCantidad = (i, raw) => {
    if (raw === '') {
      updateTv(i, 'cantidad', '')
      return
    }
    let valor = Number(raw)
    if (!Number.isFinite(valor) || valor < 0) valor = 0
    if (limite > 0) {
      const otrosTotal = tvs.reduce(
        (s, t, idx) => (idx === i ? s : s + cantidadParaSuma(t)),
        0
      )
      const maxPermitido = Math.max(0, limite - otrosTotal)
      if (valor > maxPermitido) valor = maxPermitido
    }
    updateTv(i, 'cantidad', valor)
  }

  const toggleSinLimiteTv = (i) =>
    setTvs((prev) =>
      prev.map((tv, idx) =>
        idx === i ? { ...tv, sinLimite: !tv.sinLimite, cantidad: !tv.sinLimite ? 1 : (tv.cantidad || 1) } : tv
      )
    )

  // SKU: solo alfanuméricos, máximo 10, convertido a mayúsculas.
  const updateSku = (i, raw) => {
    const limpio = String(raw).replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()
    updateTv(i, 'modelo', limpio)
  }

  const togglePallet = (i) =>
    setTvs((prev) =>
      prev.map((tv, idx) =>
        idx === i ? { ...tv, unidad: tv.unidad === 'pallet' ? 'pieza' : 'pallet' } : tv
      )
    )

  const agregarTv = () => {
    if (pedidoCerrado) return
    setTvs((prev) => [...prev, tvVacia()])
  }
  const eliminarTv = (i) => setTvs((prev) => prev.filter((_, idx) => idx !== i))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!numeroPedido.trim()) return setError('Falta el número de pedido')
    if (!pedidoNombre.trim()) return setError('Falta el nombre del pedido')
    if (!fechaLimite) return setError('Falta la fecha límite')
    if (tvs.length === 0) return setError('Agrega al menos una televisión')

    for (const [i, tv] of tvs.entries()) {
      if (!MARCAS.includes(tv.marca)) return setError(`TV #${i + 1}: marca inválida`)
      if (!PULGADAS.includes(Number(tv.pulgadas))) return setError(`TV #${i + 1}: pulgadas inválidas`)
      if (!SKU_REGEX.test(tv.modelo || '')) {
        return setError(`TV #${i + 1}: el SKU debe tener de 8 a 10 letras o números`)
      }
      if (!tv.sinLimite && (!Number(tv.cantidad) || Number(tv.cantidad) < 1)) {
        return setError(`TV #${i + 1}: cantidad inválida`)
      }
    }

    if (limite > 0 && totalUnidades !== limite) {
      return setError(
        `La suma de cantidades (${totalUnidades}) no coincide con la cantidad total del pedido (${limite}).`
      )
    }

    setEnviando(true)
    try {
      await onSubmit({
        numeroPedido: numeroPedido.trim(),
        pedidoNombre: pedidoNombre.trim(),
        fechaLimite,
        condiciones,
        cantidadTotal: limite > 0 ? limite : null,
        televisiones: tvs.map((tv) => ({
          marca: tv.marca,
          pulgadas: Number(tv.pulgadas),
          modelo: tv.modelo.trim(),
          cantidad: tv.sinLimite ? (limite > 0 ? limite : 0) : Number(tv.cantidad),
          unidad: tv.unidad === 'pallet' ? 'pallet' : 'pieza',
          sinLimite: !!tv.sinLimite,
        })),
      })
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  const hayPallets = pallets > 0
  const progresoLimite = limite > 0 ? Math.min(100, Math.round((totalUnidades / limite) * 100)) : 0

  return (
    <main className="page">
      <div className="page-header">
        <h1>{titulo}</h1>
        <p className="subtitle">{subtitulo}</p>
      </div>

      <div className="card">
        <form onSubmit={enviar}>
          <div className="section">
            <label className="label" htmlFor="numeroPedido">Número de pedido</label>
            <input
              id="numeroPedido"
              type="text"
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              placeholder="Ej. 12345"
              required
            />
          </div>

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
            <label className="label" htmlFor="fechaLimite">Fecha límite</label>
            <input
              id="fechaLimite"
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              required
            />
          </div>

          <div className="section">
            <label className="label" htmlFor="cantidadTotal">
              Cantidad total del pedido
              <span className="hint"> · déjalo vacío si no hay límite</span>
            </label>
            <input
              id="cantidadTotal"
              type="number"
              min="1"
              step="1"
              value={cantidadTotal}
              onChange={(e) => setCantidadTotal(e.target.value)}
              placeholder="Ej. 100"
            />
            {limite > 0 && (
              <div className={`limite-resumen ${pedidoCerrado ? 'lleno' : ''} ${pedidoExcedido ? 'excedido' : ''}`}>
                <div className="limite-info">
                  <span className="limite-numero">
                    {totalUnidades} <span className="limite-de">de</span> {limite}
                  </span>
                  <span className="limite-pct">{progresoLimite}%</span>
                </div>
                <div className="progreso-track">
                  <div className="progreso-fill" style={{ width: `${progresoLimite}%` }} />
                </div>
                {pedidoCerrado && !pedidoExcedido && (
                  <div className="limite-mensaje">Pedido completo · no se pueden agregar más TVs</div>
                )}
                {pedidoExcedido && (
                  <div className="limite-mensaje error">
                    Excedido por {totalUnidades - limite}. Reduce cantidades o aumenta el total.
                  </div>
                )}
              </div>
            )}
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
              const esSinLimite = !!tv.sinLimite
              const otrosTotal = tvs.reduce(
                (s, t, idx) => (idx === i ? s : s + cantidadParaSuma(t)),
                0
              )
              const maxCantidad = limite > 0 ? Math.max(0, limite - otrosTotal) : undefined
              const skuOk = SKU_REGEX.test(tv.modelo || '')
              return (
                <div key={i} className={`tv-card ${esPallet ? 'es-pallet' : ''} ${esSinLimite ? 'es-sin-limite' : ''}`}>
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
                    <label className={`tv-sin-limite-toggle ${esSinLimite ? 'activa' : ''}`}>
                      <input
                        type="checkbox"
                        checked={esSinLimite}
                        onChange={() => toggleSinLimiteTv(i)}
                      />
                      <span aria-hidden="true">∞</span>
                      Sin límite
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
                      type="text"
                      value={tv.modelo}
                      onChange={(e) => updateSku(i, e.target.value)}
                      placeholder="SKU (8-10 letras/números)"
                      pattern="[A-Za-z0-9]{8,10}"
                      title="El SKU debe tener entre 8 y 10 letras o números"
                      minLength={8}
                      maxLength={10}
                      aria-invalid={tv.modelo && !skuOk ? 'true' : undefined}
                      required
                    />
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
                    {esSinLimite ? (
                      <div
                        className="cantidad-sin-limite"
                        aria-label={limite > 0 ? `Cantidad total del pedido: ${limite}` : 'Cantidad sin límite'}
                      >
                        {limite > 0 ? (
                          <>
                            <span className="cantidad-sin-limite-numero">{limite}</span>
                            <span className="cantidad-sin-limite-texto">Total del pedido</span>
                          </>
                        ) : (
                          <>
                            <span className="cantidad-sin-limite-simbolo">∞</span>
                            <span className="cantidad-sin-limite-texto">Sin límite</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        max={maxCantidad}
                        value={tv.cantidad}
                        onChange={(e) => updateCantidad(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && i === tvs.length - 1) {
                            e.preventDefault()
                            agregarTv()
                          }
                        }}
                        placeholder={esPallet ? 'Pallets' : 'Cant.'}
                        required
                      />
                    )}
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={agregarTv}
              className="btn-agregar-tv"
              disabled={pedidoCerrado}
              title={pedidoCerrado ? 'Pedido completo (límite alcanzado)' : undefined}
            >
              <IconPlus />
              {pedidoCerrado ? 'Pedido completo' : 'Agregar televisión'}
              {!pedidoCerrado && <span className="atajo">o presiona Enter</span>}
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
                  <div className="resumen-numero">{limite > 0 ? limite : piezas}</div>
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
