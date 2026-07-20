'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { MARCAS, PULGADAS, CONDICIONES, CONDICIONES_PARTIDA, SKU_REGEX } from '@/lib/catalogos'
import { IconAlert, IconArrowRight, IconBox, IconClose, IconPlus } from './icons'
import ImportarPedidoPanel from './importar-pedido-panel'

const tvVacia = () => ({ marca: '', pulgadas: '', condicion: '', modelo: '', cantidad: 1, unidad: 'pieza', sinLimite: false, modelosAlternativos: [] })

export default function PedidoForm({
  initialData,
  onSubmit,
  titulo,
  subtitulo,
  submitLabel,
  cancelHref,
}) {
  const { t } = useTranslation()
  const tituloFinal = titulo ?? t('pedidoForm.nuevoPedido')
  const subtituloFinal = subtitulo ?? t('pedidoForm.subtituloNuevo')
  const submitLabelFinal = submitLabel ?? t('pedidoForm.crearPedido')
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
          condicion: tv.condicion || '',
          modelo: tv.modelo || '',
          cantidad: tv.cantidad || 1,
          unidad: tv.unidad || 'pieza',
          sinLimite: Boolean(tv.sinLimite),
          modelosAlternativos: Array.isArray(tv.modelosAlternativos) ? tv.modelosAlternativos : [],
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

  // SKU/Modelo: solo alfanuméricos, mayúsculas, tal cual viene (máx 20).
  const updateSku = (i, raw) => {
    const limpio = String(raw).replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
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

  // Carga en lote (pegar / Excel / foto). Mapea los items al estado de TVs.
  // Si lo único que hay es la tarjeta vacía inicial, la reemplaza; si no, agrega.
  const importarTvs = (items) => {
    if (pedidoCerrado || !items?.length) return
    const nuevas = items.map((it) => ({
      marca: it.marca,
      pulgadas: it.pulgadas ? String(it.pulgadas) : '',
      condicion: '',
      modelo: it.modelo,
      cantidad: it.cantidad || 1,
      unidad: it.unidad || 'pieza',
      sinLimite: false,
      modelosAlternativos: it.modelosAlternativos || [],
    }))
    setTvs((prev) => {
      const soloVacia = prev.length === 1 && !prev[0].marca && !prev[0].modelo
      return soloVacia ? nuevas : [...prev, ...nuevas]
    })
  }

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
      if (!CONDICIONES_PARTIDA.includes(tv.condicion)) return setError(`TV #${i + 1}: falta condición`)
      if (!SKU_REGEX.test(tv.modelo || '')) {
        return setError(`TV #${i + 1}: captura el modelo / SKU (mín. 3 letras o números)`)
      }
      if (!tv.sinLimite && (!Number(tv.cantidad) || Number(tv.cantidad) < 1)) {
        return setError(`TV #${i + 1}: cantidad inválida`)
      }
    }

    if (limite > 0) {
      const haySinLimite = tvs.some((tv) => tv.sinLimite)
      if (totalUnidades > limite) {
        return setError(
          `La suma de cantidades (${totalUnidades}) excede la cantidad total del pedido (${limite}).`
        )
      }
      if (totalUnidades < limite && !haySinLimite) {
        return setError(
          `La suma de cantidades (${totalUnidades}) no coincide con la cantidad total del pedido (${limite}).`
        )
      }
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
          condicion: tv.condicion,
          modelo: tv.modelo.trim(),
          cantidad: tv.sinLimite ? (limite > 0 ? limite : 0) : Number(tv.cantidad),
          unidad: tv.unidad === 'pallet' ? 'pallet' : 'pieza',
          sinLimite: !!tv.sinLimite,
          modelosAlternativos: tv.modelosAlternativos || [],
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
        <h1>{tituloFinal}</h1>
        <p className="subtitle">{subtituloFinal}</p>
      </div>

      <div className="card">
        <form onSubmit={enviar}>
          <div className="section">
            <label className="label" htmlFor="numeroPedido">{t('pedidoForm.numeroPedido')}</label>
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
            <label className="label" htmlFor="pedidoNombre">{t('pedidoForm.nombrePedido')}</label>
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
            <label className="label" htmlFor="fechaLimite">{t('pedidoForm.fechaLimite')}</label>
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
              {t('pedidoForm.cantidadTotal')}
              <span className="hint"> · {t('pedidoForm.cantidadTotalHint')}</span>
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
            <div className="label">{t('pedidoForm.condiciones')}</div>
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
              <h2>{t('pedidoForm.televisiones')}</h2>
              <span className="count">{tvs.length}</span>
            </div>

            {!pedidoCerrado && <ImportarPedidoPanel onImportar={importarTvs} />}

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
                      {t('pedidoForm.pallet')}
                    </label>
                    <label className={`tv-sin-limite-toggle ${esSinLimite ? 'activa' : ''}`}>
                      <input
                        type="checkbox"
                        checked={esSinLimite}
                        onChange={() => toggleSinLimiteTv(i)}
                      />
                      <span aria-hidden="true">∞</span>
                      {t('pedidoForm.sinLimite')}
                    </label>
                    {tvs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarTv(i)}
                        className="btn-quitar"
                        aria-label="Quitar TV"
                      >
                        <IconClose width={14} height={14} />
                        {t('pedidoForm.quitar')}
                      </button>
                    )}
                  </div>
                  <div className="tv-card-grid">
                    <input
                      ref={(el) => { if (el) inputRefs.current[i] = el }}
                      type="text"
                      value={tv.modelo}
                      onChange={(e) => updateSku(i, e.target.value)}
                      placeholder="SKU / Modelo"
                      pattern="[A-Za-z0-9]{3,20}"
                      title="Código del modelo tal como viene en el pedido"
                      minLength={3}
                      maxLength={20}
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
                    <div className="tv-condicion-field">
                      <select
                        value={tv.condicion}
                        onChange={(e) => updateTv(i, 'condicion', e.target.value)}
                        aria-label="Condición"
                        required
                      >
                        <option value="">{t('pedidoForm.condicion')}</option>
                        {CONDICIONES_PARTIDA.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {tv.condicion && (
                        <span className={`tag tag-${tv.condicion.toLowerCase()} tv-condicion-preview`}>
                          {tv.condicion}
                        </span>
                      )}
                    </div>
                    {esSinLimite ? (
                      <div
                        className="cantidad-sin-limite"
                        aria-label={limite > 0 ? `Cantidad total del pedido: ${limite}` : 'Cantidad sin límite'}
                      >
                        {limite > 0 ? (
                          <>
                            <span className="cantidad-sin-limite-numero">{limite}</span>
                            <span className="cantidad-sin-limite-texto">{t('pedidoForm.cantidadTotal')}</span>
                          </>
                        ) : (
                          <>
                            <span className="cantidad-sin-limite-simbolo">∞</span>
                            <span className="cantidad-sin-limite-texto">{t('pedidoForm.sinLimite')}</span>
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
                  {tv.modelosAlternativos?.length > 0 && (
                    <div className="tv-alt-hint">
                      También válido: {tv.modelosAlternativos.join(', ')}
                    </div>
                  )}
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
              {pedidoCerrado ? t('pedidoForm.pedidoCompleto') : t('pedidoForm.agregarTelevision')}
              {!pedidoCerrado && <span className="atajo">{t('pedidoForm.atajoEnter')}</span>}
            </button>
          </div>

          {totalUnidades > 0 && (
            <div className="resumen-pedido">
              <div className="resumen-item">
                <div className="resumen-numero">{tvs.length}</div>
                <div className="resumen-etiqueta">{t('pedidoForm.modelos')}</div>
              </div>
              <div className="resumen-item">
                <div className="resumen-numero">{marcasUnicas}</div>
                <div className="resumen-etiqueta">{t('pedidoForm.marcas')}</div>
              </div>
              {hayPallets ? (
                <>
                  <div className="resumen-item">
                    <div className="resumen-numero">{pallets}</div>
                    <div className="resumen-etiqueta">{t('pedidoForm.pallets')}</div>
                  </div>
                  <div className="resumen-item">
                    <div className="resumen-numero">{piezas}</div>
                    <div className="resumen-etiqueta">{t('pedidoForm.piezas')}</div>
                  </div>
                </>
              ) : (
                <div className="resumen-item">
                  <div className="resumen-numero">{limite > 0 ? limite : piezas}</div>
                  <div className="resumen-etiqueta">{t('pedidoForm.tvsTotal')}</div>
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
                {t('common.cancelar')}
              </Link>
            )}
            <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
              {enviando ? t('common.guardando') : (
                <>
                  {submitLabelFinal}
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
