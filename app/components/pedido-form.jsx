'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { MARCAS, PULGADAS, CONDICIONES, CONDICIONES_FRECUENTES, SKU_REGEX } from '@/lib/catalogos'
import {
  IconAlert,
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
  IconBox,
  IconChevronDown,
  IconClipboardList,
  IconCopy,
  IconExcel,
  IconHelp,
  IconPlus,
  IconTrash,
} from './icons'
import ImportarPedidoPanel from './importar-pedido-panel'

// Condiciones que no caben en los accesos directos — se ofrecen en el
// desplegable "Más condiciones" del selector de condición activa.
const CONDICIONES_MAS = CONDICIONES.filter((c) => !CONDICIONES_FRECUENTES.includes(c))

const tvVacia = (overrides = {}) => ({
  marca: '',
  pulgadas: '',
  condiciones: [CONDICIONES_FRECUENTES[0]],
  modelo: '',
  cantidad: 1,
  unidad: 'pieza',
  sinLimite: false,
  modelosAlternativos: [],
  ...overrides,
})

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
  const [cantidadTotal, setCantidadTotal] = useState(
    initialData?.cantidadTotal != null && initialData?.cantidadTotal > 0
      ? String(initialData.cantidadTotal)
      : ''
  )
  // Valores "activos" del toolbar: se aplican SOLO a las TVs nuevas que se
  // agreguen a partir de ahora (manual, duplicado o importación) — nunca de
  // forma retroactiva a filas ya existentes, igual que pidió el operador.
  const [condicionActiva, setCondicionActiva] = useState(CONDICIONES_FRECUENTES[0])
  const condicionEsExtra = CONDICIONES_MAS.includes(condicionActiva)
  const [masCondicionesAbierto, setMasCondicionesAbierto] = useState(false)
  const [palletPorDefecto, setPalletPorDefecto] = useState(false)
  const [sinLimitePorDefecto, setSinLimitePorDefecto] = useState(false)
  const [tvs, setTvs] = useState(
    initialData?.televisiones?.length
      ? initialData.televisiones.map((tv) => ({
          marca: tv.marca || '',
          pulgadas: tv.pulgadas !== undefined ? String(tv.pulgadas) : '',
          // Compatibilidad con pedidos creados antes de que una partida
          // pudiera tener varias condiciones a la vez (guardaban `condicion`
          // como string suelto en vez de `condiciones` como arreglo).
          condiciones: Array.isArray(tv.condiciones) && tv.condiciones.length > 0
            ? tv.condiciones
            : (tv.condicion ? [tv.condicion] : [CONDICIONES_FRECUENTES[0]]),
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
  const tablaRef = useRef(null)
  const previousLength = useRef(tvs.length)
  const masMenuRef = useRef(null)
  const [filaCondicionAbierta, setFilaCondicionAbierta] = useState(null)
  const condicionBtnRefs = useRef([])
  const condicionPortalRef = useRef(null)
  const [condicionPopoverRect, setCondicionPopoverRect] = useState(null)

  // El popover de condición por fila se renderiza en un portal (document.body,
  // position: fixed) en vez de dentro de la celda: la tabla scrollea
  // horizontalmente (.tabla-wrap tiene overflow-x: auto) y un popover
  // absoluto ahí adentro queda recortado/atrapado en ese scroll. Un portal
  // lo saca de ese contenedor por completo.
  useEffect(() => {
    if (filaCondicionAbierta == null) {
      setCondicionPopoverRect(null)
      return
    }
    const actualizarPosicion = () => {
      const btn = condicionBtnRefs.current[filaCondicionAbierta]
      if (!btn) return
      const r = btn.getBoundingClientRect()
      setCondicionPopoverRect({ top: r.bottom + 6, left: r.left, minWidth: r.width })
    }
    actualizarPosicion()
    window.addEventListener('resize', actualizarPosicion)
    window.addEventListener('scroll', actualizarPosicion, true)
    return () => {
      window.removeEventListener('resize', actualizarPosicion)
      window.removeEventListener('scroll', actualizarPosicion, true)
    }
  }, [filaCondicionAbierta])

  // Cierra el desplegable "Más condiciones" del toolbar y el popover de
  // condición por fila al hacer clic fuera o con Escape — mismo patrón que
  // ya usa el menú de usuario del nav. El popover por fila vive en un
  // portal, así que se revisan tanto el botón que lo abrió como su propio
  // contenido (ninguno de los dos está dentro del otro en el DOM).
  useEffect(() => {
    function onClickFuera(e) {
      if (masMenuRef.current && !masMenuRef.current.contains(e.target)) {
        setMasCondicionesAbierto(false)
      }
      if (filaCondicionAbierta != null) {
        const btn = condicionBtnRefs.current[filaCondicionAbierta]
        const dentroBoton = btn && btn.contains(e.target)
        const dentroPopover = condicionPortalRef.current && condicionPortalRef.current.contains(e.target)
        if (!dentroBoton && !dentroPopover) setFilaCondicionAbierta(null)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMasCondicionesAbierto(false)
        setFilaCondicionAbierta(null)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filaCondicionAbierta])

  // Enter avanza al siguiente campo enfocable de toda la tabla (SKU → Marca
  // → Pulgada → Cantidad → SKU de la fila siguiente...), en vez de intentar
  // enviar el formulario. En el último campo enfocable, agrega una TV nueva
  // — mismo comportamiento que ya existía, generalizado a cualquier columna.
  const onTablaKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const tag = e.target.tagName
    if (tag !== 'INPUT' && tag !== 'SELECT') return
    e.preventDefault()
    const focosables = Array.from(tablaRef.current?.querySelectorAll('tbody input, tbody select') || [])
    const idx = focosables.indexOf(e.target)
    if (idx === -1) return
    if (idx < focosables.length - 1) {
      focosables[idx + 1].focus()
    } else {
      agregarTv()
    }
  }

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

  // Una misma partida/SKU puede aceptar varias condiciones a la vez (ej.
  // GRA y GRB). Nunca se permite dejar el arreglo vacío — si solo queda una
  // condición marcada, no se puede desmarcar.
  const toggleCondicionEnFila = (i, codigo) =>
    setTvs((prev) =>
      prev.map((tv, idx) => {
        if (idx !== i) return tv
        const actuales = tv.condiciones || []
        const yaEsta = actuales.includes(codigo)
        if (yaEsta && actuales.length === 1) return tv
        const siguientes = yaEsta ? actuales.filter((c) => c !== codigo) : [...actuales, codigo]
        return { ...tv, condiciones: siguientes }
      })
    )

  const agregarTv = () => {
    if (pedidoCerrado) return
    setTvs((prev) => [...prev, tvVacia({
      condiciones: [condicionActiva],
      unidad: palletPorDefecto ? 'pallet' : 'pieza',
      sinLimite: sinLimitePorDefecto,
    })])
  }
  const eliminarTv = (i) => setTvs((prev) => prev.filter((_, idx) => idx !== i))

  // Duplica una fila completa (todos sus valores actuales) justo debajo de
  // ella — respeta el mismo tope de cantidad total que "Agregar televisión".
  const duplicarTv = (i) => {
    if (pedidoCerrado) return
    setTvs((prev) => {
      const original = prev[i]
      if (!original) return prev
      const copia = {
        ...original,
        condiciones: [...(original.condiciones || [])],
        modelosAlternativos: [...(original.modelosAlternativos || [])],
      }
      const next = [...prev]
      next.splice(i + 1, 0, copia)
      return next
    })
  }

  const moverArriba = (i) => {
    if (i <= 0) return
    setTvs((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  const moverAbajo = (i) => {
    setTvs((prev) => {
      if (i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  // Carga en lote (pegar / Excel / foto). Mapea los items al estado de TVs.
  // Si lo único que hay es la tarjeta vacía inicial, la reemplaza; si no, agrega.
  // Las TVs importadas también son "nuevas", así que heredan los mismos
  // valores activos del toolbar (condición / pallet / sin límite).
  const importarTvs = (items) => {
    if (pedidoCerrado || !items?.length) return
    const nuevas = items.map((it) => ({
      marca: it.marca,
      pulgadas: it.pulgadas ? String(it.pulgadas) : '',
      condiciones: [condicionActiva],
      modelo: it.modelo,
      cantidad: it.cantidad || 1,
      unidad: palletPorDefecto ? 'pallet' : (it.unidad || 'pieza'),
      sinLimite: sinLimitePorDefecto,
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
      if (!tv.condiciones?.length || tv.condiciones.some((c) => !CONDICIONES.includes(c))) {
        return setError(`TV #${i + 1}: falta condición`)
      }
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

    // El pedido ya no pide sus propias "condiciones" por separado — se
    // construyen automáticamente a partir de las condiciones únicas que
    // realmente se usaron en las televisiones capturadas (sin duplicar la
    // captura). Cada TV puede aportar varias condiciones a la vez.
    const condicionesUnicas = [...new Set(tvs.flatMap((tv) => tv.condiciones || []))]

    setEnviando(true)
    try {
      await onSubmit({
        numeroPedido: numeroPedido.trim(),
        pedidoNombre: pedidoNombre.trim(),
        fechaLimite,
        condiciones: condicionesUnicas,
        cantidadTotal: limite > 0 ? limite : null,
        televisiones: tvs.map((tv) => ({
          marca: tv.marca,
          pulgadas: Number(tv.pulgadas),
          condiciones: tv.condiciones,
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
    <main className="pedido-nuevo-page">
      <div className="pedido-nuevo-header">
        <div>
          <h1 className="pedido-nuevo-titulo">{tituloFinal}</h1>
          <p className="pedido-nuevo-subtitulo">{subtituloFinal}</p>
        </div>
        <button type="button" className="btn-ayuda" title="¿Necesitas ayuda?">
          <IconHelp />
          <span>¿Necesitas ayuda?</span>
        </button>
      </div>

      <form onSubmit={enviar} className="pedido-nuevo-grid">
        <section className="card card-pedido-seccion card-info-general">
          <header className="card-seccion-header">
            <span className="card-seccion-icono"><IconClipboardList /></span>
            <div>
              <h2 className="card-seccion-titulo">Información general</h2>
              <p className="card-seccion-desc">Datos base del pedido</p>
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
          <header className="card-seccion-header card-televisiones-header">
            <span className="card-seccion-icono"><IconClipboardList /></span>
            <div>
              <h2 className="card-seccion-titulo">Televisiones</h2>
              <p className="card-seccion-desc">Agrega las TVs que incluye este pedido.</p>
            </div>
            <span className="card-televisiones-contador">
              {tvs.length} {tvs.length === 1 ? 'televisión' : 'televisiones'}
            </span>
          </header>

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

            <div className="tv-condicion-activa" role="group" aria-label="Condición activa">
              <span className="tv-condicion-activa-label">Condición activa</span>
              {CONDICIONES_FRECUENTES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} ${condicionActiva === c ? 'activa' : ''}`}
                  onClick={() => setCondicionActiva(c)}
                  aria-pressed={condicionActiva === c}
                  title={`Las próximas televisiones que agregues tomarán la condición ${c}`}
                >
                  <span className="tv-condicion-chip-dot" aria-hidden="true" />
                  {c}
                </button>
              ))}

              <div className="tv-condicion-mas" ref={masMenuRef}>
                <button
                  type="button"
                  className={`tv-condicion-chip tv-condicion-mas-btn ${
                    condicionEsExtra ? `tv-condicion-chip-${condicionActiva.toLowerCase()} activa` : ''
                  }`}
                  onClick={() => setMasCondicionesAbierto((v) => !v)}
                  aria-expanded={masCondicionesAbierto}
                  aria-haspopup="listbox"
                  title="Ver más condiciones disponibles"
                >
                  {condicionEsExtra && <span className="tv-condicion-chip-dot" aria-hidden="true" />}
                  {condicionEsExtra ? condicionActiva : (
                    <>
                      <span className="tv-condicion-mas-texto-completo">Más condiciones</span>
                      <span className="tv-condicion-mas-texto-corto">Más</span>
                    </>
                  )}
                  <IconChevronDown />
                </button>
                {masCondicionesAbierto && (
                  <div className="tv-condicion-mas-dropdown" role="listbox">
                    {CONDICIONES_MAS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={condicionActiva === c}
                        className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} tv-condicion-mas-item ${
                          condicionActiva === c ? 'activa' : ''
                        }`}
                        onClick={() => {
                          setCondicionActiva(c)
                          setMasCondicionesAbierto(false)
                        }}
                        title={`Las próximas televisiones que agregues tomarán la condición ${c}`}
                      >
                        <span className="tv-condicion-chip-dot" aria-hidden="true" />
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className={`tv-toolbar-toggle ${palletPorDefecto ? 'activa' : ''}`}
              onClick={() => setPalletPorDefecto((v) => !v)}
              aria-pressed={palletPorDefecto}
              title="Las próximas televisiones que agregues serán tipo Pallet"
            >
              <IconBox />
              {t('pedidoForm.pallet')}
            </button>

            <button
              type="button"
              className={`tv-toolbar-toggle ${sinLimitePorDefecto ? 'activa' : ''}`}
              onClick={() => setSinLimitePorDefecto((v) => !v)}
              aria-pressed={sinLimitePorDefecto}
              title="Las próximas televisiones que agregues serán Sin límite"
            >
              <span aria-hidden="true">∞</span>
              {t('pedidoForm.sinLimite')}
            </button>
          </div>

          <datalist id="marcas-list">
            {MARCAS.map((m) => <option key={m} value={m} />)}
          </datalist>

          {tvs.length === 0 ? (
            <div className="empty tv-empty-state">
              <IconClipboardList width={48} height={48} />
              <h3>No has agregado televisiones.</h3>
              <button type="button" className="btn btn-primary" onClick={agregarTv}>
                <IconPlus /> Agregar primera televisión
              </button>
            </div>
          ) : (
            <>
              <div className="tabla-wrap tv-tabla-wrap">
                <table className="tabla-pedidos tv-tabla-moderna" ref={tablaRef} onKeyDown={onTablaKeyDown}>
                  <thead>
                    <tr>
                      <th className="tv-col-num">#</th>
                      <th>SKU / Modelo</th>
                      <th>Marca</th>
                      <th>Pulgada</th>
                      <th>Cantidad</th>
                      <th>Tipo</th>
                      <th className="tv-col-condicion">Condición</th>
                      <th className="tv-col-acciones"></th>
                    </tr>
                  </thead>
                  <tbody>
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
                                placeholder={esPallet ? 'Pallets' : 'Cant.'}
                                required
                              />
                            )}
                          </td>
                          <td data-label="Tipo">
                            <div className="tv-segment" role="group" aria-label="Tipo de televisión">
                              <button
                                type="button"
                                className={`tv-segment-btn ${esPallet ? 'activo' : ''}`}
                                onClick={() => togglePallet(i)}
                                aria-pressed={esPallet}
                                title="Marcar como pallet"
                              >
                                <IconBox /> {t('pedidoForm.pallet')}
                              </button>
                              <button
                                type="button"
                                className={`tv-segment-btn ${esSinLimite ? 'activo' : ''}`}
                                onClick={() => toggleSinLimiteTv(i)}
                                aria-pressed={esSinLimite}
                                title="Marcar como sin límite"
                              >
                                <span aria-hidden="true">∞</span> {t('pedidoForm.sinLimite')}
                              </button>
                            </div>
                          </td>
                          <td className="tv-col-condicion" data-label="Condición">
                            <button
                              type="button"
                              ref={(el) => { condicionBtnRefs.current[i] = el }}
                              className="tv-fila-condicion-btn"
                              onClick={() => setFilaCondicionAbierta((prev) => (prev === i ? null : i))}
                              aria-expanded={filaCondicionAbierta === i}
                              aria-haspopup="listbox"
                              title="Editar condición(es) de esta televisión"
                            >
                              <span className="tv-fila-condicion-resumen">
                                {(tv.condiciones || []).slice(0, 2).map((c) => (
                                  <span
                                    key={c}
                                    className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} tv-fila-condicion-chip`}
                                  >
                                    <span className="tv-condicion-chip-dot" aria-hidden="true" />
                                    {c}
                                  </span>
                                ))}
                                {(tv.condiciones?.length || 0) > 2 && (
                                  <span className="tv-fila-condicion-mas-badge">+{tv.condiciones.length - 2}</span>
                                )}
                              </span>
                              <IconChevronDown />
                            </button>
                          </td>
                          <td className="tv-col-acciones" data-label="Acciones">
                            <div className="tv-acciones-fila">
                              <button
                                type="button"
                                onClick={() => duplicarTv(i)}
                                className="btn-icono"
                                aria-label={`Duplicar TV ${i + 1}`}
                                title="Duplicar fila"
                                disabled={pedidoCerrado}
                              >
                                <IconCopy />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverArriba(i)}
                                className="btn-icono"
                                aria-label={`Mover TV ${i + 1} arriba`}
                                title="Mover arriba"
                                disabled={i === 0}
                              >
                                <IconArrowUp />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverAbajo(i)}
                                className="btn-icono"
                                aria-label={`Mover TV ${i + 1} abajo`}
                                title="Mover abajo"
                                disabled={i === tvs.length - 1}
                              >
                                <IconArrowDown />
                              </button>
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
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filaCondicionAbierta !== null && condicionPopoverRect && typeof document !== 'undefined' && createPortal(
                <div
                  ref={condicionPortalRef}
                  className="tv-fila-condicion-dropdown-portal"
                  role="listbox"
                  aria-multiselectable="true"
                  style={{
                    position: 'fixed',
                    top: condicionPopoverRect.top,
                    left: condicionPopoverRect.left,
                    minWidth: condicionPopoverRect.minWidth,
                  }}
                >
                  {CONDICIONES.map((c) => {
                    const seleccionada = (tvs[filaCondicionAbierta]?.condiciones || []).includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={seleccionada}
                        className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} tv-condicion-mas-item ${seleccionada ? 'activa' : ''}`}
                        onClick={() => toggleCondicionEnFila(filaCondicionAbierta, c)}
                      >
                        <span className="tv-condicion-chip-dot" aria-hidden="true" />
                        {c}
                      </button>
                    )
                  })}
                </div>,
                document.body
              )}

              <div className="tv-footer-resumen">
                <div className="tv-footer-item">
                  <span className="tv-footer-label">{t('pedidoForm.modelos')}</span>
                  <strong className="tv-footer-numero">{tvs.length}</strong>
                </div>
                <div className="tv-footer-item">
                  <span className="tv-footer-label">{t('pedidoForm.marcas')}</span>
                  <strong className="tv-footer-numero">{marcasUnicas}</strong>
                </div>
                <div className="tv-footer-item">
                  <span className="tv-footer-label">{t('pedidoForm.tvsTotal')}</span>
                  <strong className="tv-footer-numero">{piezas}</strong>
                </div>
                <div className="tv-footer-item">
                  <span className="tv-footer-label">Cantidad total</span>
                  <strong className="tv-footer-numero">{totalUnidades}</strong>
                </div>
                <div className="tv-footer-item">
                  <span className="tv-footer-label">{t('pedidoForm.pallets')}</span>
                  <strong className="tv-footer-numero">{pallets}</strong>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="card card-pedido-seccion card-resumen-sticky">
          <h2 className="card-seccion-titulo">Resumen del pedido</h2>

          <div className="resumen-lista">
            <div className="resumen-fila resumen-fila-modelos">
              <span className="resumen-fila-icono"><IconClipboardList /></span>
              <span className="resumen-fila-label">{t('pedidoForm.modelos')}</span>
              <strong className="resumen-fila-numero">{tvs.length}</strong>
            </div>
            <div className="resumen-fila resumen-fila-marcas">
              <span className="resumen-fila-icono"><IconExcel /></span>
              <span className="resumen-fila-label">{t('pedidoForm.marcas')}</span>
              <strong className="resumen-fila-numero">{marcasUnicas}</strong>
            </div>
            <div className="resumen-fila resumen-fila-tvs">
              <span className="resumen-fila-icono"><IconBox /></span>
              <span className="resumen-fila-label">{t('pedidoForm.tvsTotal')}</span>
              <strong className="resumen-fila-numero">{piezas}</strong>
            </div>
            {hayPallets && (
              <div className="resumen-fila resumen-fila-pallets">
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
