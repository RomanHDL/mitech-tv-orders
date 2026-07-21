'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { MARCAS, PULGADAS, CONDICIONES, CONDICIONES_PARTIDA, SKU_REGEX } from '@/lib/catalogos'
import {
  IconAlert,
  IconArrowRight,
  IconBox,
  IconClipboardList,
  IconClose,
  IconExcel,
  IconHelp,
  IconPlus,
  IconSearch,
  IconTrash,
} from './icons'
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
  const [busquedaTv, setBusquedaTv] = useState('')

  const inputRefs = useRef([])
  const previousLength = useRef(tvs.length)

  useEffect(() => {
    if (tvs.length > previousLength.current) {
      // Si había un filtro activo, se limpia para que la fila recién
      // agregada quede visible (si no, el efecto de foco no la encontraría).
      setBusquedaTv('')
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

  // Filtro visual de la tabla (no toca el estado real de `tvs`; conserva el
  // índice original `i` para que todos los handlers sigan funcionando igual).
  const busquedaNormalizada = busquedaTv.trim().toLowerCase()
  const filasVisibles = tvs
    .map((tv, i) => ({ tv, i }))
    .filter(({ tv }) => {
      if (!busquedaNormalizada) return true
      return (
        (tv.modelo || '').toLowerCase().includes(busquedaNormalizada) ||
        (tv.marca || '').toLowerCase().includes(busquedaNormalizada)
      )
    })

  return (
    <main className="pedido-nuevo-page">
      <div className="pedido-nuevo-header">
        <div>
          <h1 className="pedido-nuevo-titulo">{tituloFinal}</h1>
          <p className="pedido-nuevo-subtitulo">{subtituloFinal}</p>
        </div>
        <button type="button" className="btn-ayuda" title="Ayuda">
          <IconHelp />
          <span>Ayuda</span>
        </button>
      </div>

      <form onSubmit={enviar} className="pedido-nuevo-grid">
        <section className="card card-pedido-seccion card-info-general">
          <header className="card-seccion-header">
            <span className="card-seccion-icono"><IconClipboardList /></span>
            <div>
              <h2 className="card-seccion-titulo">Información general</h2>
              <p className="card-seccion-desc">Datos base de este pedido</p>
            </div>
          </header>

          <div className="info-general-grid">
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

            <div className="section info-general-full">
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
          </div>
        </section>

        <section className="card card-pedido-seccion card-importar-wrap">
          <header className="card-seccion-header">
            <span className="card-seccion-icono"><IconExcel /></span>
            <div>
              <h2 className="card-seccion-titulo">Importar pedido</h2>
              <p className="card-seccion-desc">Pega texto, sube un Excel o una foto</p>
            </div>
          </header>
          <ImportarPedidoPanel onImportar={importarTvs} disabled={pedidoCerrado} />
        </section>

        <section className="card card-pedido-seccion card-televisiones">
          <div className="tv-toolbar">
            <button
              type="button"
              onClick={agregarTv}
              className="btn btn-primary"
              disabled={pedidoCerrado}
              title={pedidoCerrado ? 'Pedido completo (límite alcanzado)' : undefined}
            >
              <IconPlus />
              {pedidoCerrado ? t('pedidoForm.pedidoCompleto') : t('pedidoForm.agregarTelevision')}
            </button>

            {tvs.length > 1 && (
              <div className="search-box tv-toolbar-buscar">
                <IconSearch className="icon-search" />
                <input
                  type="text"
                  placeholder="Buscar SKU o marca…"
                  value={busquedaTv}
                  onChange={(e) => setBusquedaTv(e.target.value)}
                />
              </div>
            )}

            <span className="tv-toolbar-count">
              {tvs.length} {tvs.length === 1 ? 'televisión' : 'televisiones'}
            </span>
          </div>

          <datalist id="marcas-list">
            {MARCAS.map((m) => <option key={m} value={m} />)}
          </datalist>

          {tvs.length === 0 ? (
            <div className="empty tv-empty-state">
              <IconClipboardList width={48} height={48} />
              <h3>Aún no has agregado televisiones</h3>
              <p>Comienza agregando la primera televisión o importa un archivo Excel.</p>
              <button type="button" className="btn btn-primary" onClick={agregarTv}>
                <IconPlus /> {t('pedidoForm.agregarTelevision')}
              </button>
            </div>
          ) : filasVisibles.length === 0 ? (
            <div className="empty tv-empty-state">
              <IconSearch width={40} height={40} />
              <h3>Sin coincidencias</h3>
              <p>Ninguna televisión coincide con &quot;{busquedaTv}&quot;.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setBusquedaTv('')}>
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="tabla-wrap tv-tabla-wrap">
              <table className="tabla-pedidos tv-tabla-moderna">
                <thead>
                  <tr>
                    <th className="tv-col-num">#</th>
                    <th>SKU / Modelo</th>
                    <th>Marca</th>
                    <th>Pulgada</th>
                    <th>Condición</th>
                    <th>Cantidad</th>
                    <th>Tipo</th>
                    <th className="tv-col-acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map(({ tv, i }) => {
                    const esPallet = tv.unidad === 'pallet'
                    const esSinLimite = !!tv.sinLimite
                    const otrosTotal = tvs.reduce(
                      (s, t, idx) => (idx === i ? s : s + cantidadParaSuma(t)),
                      0
                    )
                    const maxCantidad = limite > 0 ? Math.max(0, limite - otrosTotal) : undefined
                    const skuOk = SKU_REGEX.test(tv.modelo || '')
                    return (
                      <tr key={i} className={esPallet ? 'es-pallet' : ''}>
                        <td className="tv-col-num" data-label="#">{i + 1}</td>
                        <td data-label="SKU / Modelo">
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
                          {tv.modelosAlternativos?.length > 0 && (
                            <div className="tv-alt-hint">
                              También válido: {tv.modelosAlternativos.join(', ')}
                            </div>
                          )}
                        </td>
                        <td data-label="Marca">
                          <input
                            list="marcas-list"
                            value={tv.marca}
                            onChange={(e) => updateTv(i, 'marca', e.target.value)}
                            placeholder="Marca"
                            required
                          />
                        </td>
                        <td data-label="Pulgada">
                          <select
                            value={tv.pulgadas}
                            onChange={(e) => updateTv(i, 'pulgadas', e.target.value)}
                            required
                          >
                            <option value="">—</option>
                            {PULGADAS.map((p) => (
                              <option key={p} value={p}>{p}&quot;</option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Condición">
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
                        </td>
                        <td data-label="Cantidad">
                          {esSinLimite ? (
                            <div
                              className="cantidad-sin-limite"
                              aria-label={limite > 0 ? `Cantidad total del pedido: ${limite}` : 'Cantidad sin límite'}
                            >
                              {limite > 0 ? (
                                <span className="cantidad-sin-limite-numero">{limite}</span>
                              ) : (
                                <span className="cantidad-sin-limite-simbolo">∞</span>
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
                        </td>
                        <td data-label="Tipo">
                          <div className="tv-tipo-celda">
                            <label className={`tv-pallet-toggle ${esPallet ? 'activa' : ''}`}>
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
                          </div>
                        </td>
                        <td className="tv-col-acciones" data-label="Acciones">
                          {tvs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarTv(i)}
                              className="btn-icono btn-icono-eliminar"
                              aria-label={`Quitar TV ${i + 1}`}
                              title={t('pedidoForm.quitar')}
                            >
                              <IconTrash />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="card card-pedido-seccion card-resumen-sticky">
          <h2 className="card-seccion-titulo">Resumen del pedido</h2>

          <div className="resumen-lista">
            <div className="resumen-fila">
              <span className="resumen-fila-icono"><IconClipboardList /></span>
              <span className="resumen-fila-label">{t('pedidoForm.modelos')}</span>
              <strong className="resumen-fila-numero">{tvs.length}</strong>
            </div>
            <div className="resumen-fila">
              <span className="resumen-fila-icono"><IconExcel /></span>
              <span className="resumen-fila-label">{t('pedidoForm.marcas')}</span>
              <strong className="resumen-fila-numero">{marcasUnicas}</strong>
            </div>
            <div className="resumen-fila">
              <span className="resumen-fila-icono"><IconBox /></span>
              <span className="resumen-fila-label">{t('pedidoForm.tvsTotal')}</span>
              <strong className="resumen-fila-numero">{piezas}</strong>
            </div>
            {hayPallets && (
              <div className="resumen-fila">
                <span className="resumen-fila-icono"><IconBox /></span>
                <span className="resumen-fila-label">{t('pedidoForm.pallets')}</span>
                <strong className="resumen-fila-numero">{pallets}</strong>
              </div>
            )}
            <div className="resumen-fila resumen-fila-total">
              <span className="resumen-fila-label">Cantidad total</span>
              <strong className="resumen-fila-numero">{totalUnidades}</strong>
            </div>
          </div>

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <div className="pedido-nuevo-acciones">
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
        </aside>
      </form>
    </main>
  )
}
