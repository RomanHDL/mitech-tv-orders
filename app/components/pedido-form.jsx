'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CONDICIONES, CONDICIONES_FRECUENTES, SKU_REGEX, marcaValida } from '@/lib/catalogos'
import { ordenarPorMarcaYPulgadas } from '@/lib/orden-televisiones'
import {
  createGroupKey,
  filtrarMetasHuerfanas,
  groupProductsByBrandAndSize,
  isRequestedQuantityDefined,
} from '@/lib/surtido-grupos'
import {
  IconAlert,
  IconArrowRight,
  IconBox,
  IconClipboardList,
  IconExcel,
  IconHelp,
  IconPlus,
} from './icons'
import GroupedOrderProducts from './grouped-order-products'
import MarcasDatalist from './marcas-datalist'
import ImportarPedidoPanel from './importar-pedido-panel'

const tvVacia = (overrides = {}) => ({
  marca: '',
  pulgadas: '',
  condiciones: [CONDICIONES_FRECUENTES[0]],
  modelo: '',
  unidad: 'pieza',
  modelosAlternativos: [],
  ...overrides,
})

// Deriva un mapa { groupKey: requestedQuantity|null } con una entrada por
// cada grupo (marca+pulgadas) que YA tiene al menos un SKU válido —
// preserva las metas existentes (`base`) y agrega `null` ("por definir")
// para cualquier grupo nuevo que todavía no tenga una entrada explícita.
function sincronizarGroupTargets(tvs, base) {
  const brandSections = groupProductsByBrandAndSize(
    tvs.filter((tv) => tv.marca && tv.pulgadas),
    base,
  )
  const siguiente = { ...base }
  for (const brand of brandSections) {
    for (const group of brand.sizes) {
      if (!Object.prototype.hasOwnProperty.call(siguiente, group.key)) {
        siguiente[group.key] = null
      }
    }
  }
  return siguiente
}

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
  // forma retroactiva a filas ya existentes.
  const [condicionActiva, setCondicionActiva] = useState(CONDICIONES_FRECUENTES[0])
  const [palletPorDefecto, setPalletPorDefecto] = useState(false)

  const [tvs, setTvs] = useState(
    initialData?.televisiones?.length
      // Mismo orden "canónico" que ya usa Surtir (agrupado por marca,
      // ordenado por pulgadas dentro de cada marca) — solo al ABRIR un
      // pedido ya existente para editarlo.
      ? ordenarPorMarcaYPulgadas(initialData.televisiones).map((tv) => ({
          marca: tv.marca || '',
          pulgadas: tv.pulgadas !== undefined ? String(tv.pulgadas) : '',
          // Compatibilidad con pedidos creados antes de que una partida
          // pudiera tener varias condiciones a la vez (guardaban `condicion`
          // como string suelto en vez de `condiciones` como arreglo).
          condiciones: Array.isArray(tv.condiciones) && tv.condiciones.length > 0
            ? tv.condiciones
            : (tv.condicion ? [tv.condicion] : [CONDICIONES_FRECUENTES[0]]),
          modelo: tv.modelo || '',
          unidad: tv.unidad || 'pieza',
          modelosAlternativos: Array.isArray(tv.modelosAlternativos) ? tv.modelosAlternativos : [],
        }))
      : [tvVacia()]
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // groupTargets: { "LG-65": 30, "SAMSUNG-85": null, ... } — la meta le
  // pertenece al GRUPO (marca+pulgadas), nunca a cada SKU. Se siembra desde
  // el pedido existente (metasGrupo) al editar; para un pedido nuevo, cada
  // grupo que se va formando arranca en null ("por definir") hasta que el
  // usuario captura una cantidad.
  const [groupTargets, setGroupTargets] = useState(() =>
    sincronizarGroupTargets(
      initialData?.televisiones?.length ? tvs : [],
      initialData?.metasGrupo || {},
    )
  )
  // Mantiene groupTargets sincronizado cuando cambian marca/pulgadas/altas/
  // bajas — nunca borra una meta ya capturada, solo agrega "por definir"
  // para grupos nuevos. La limpieza de metas huérfanas ocurre al enviar.
  useEffect(() => {
    setGroupTargets((prev) => sincronizarGroupTargets(tvs, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvs])

  const productosRef = useRef(null)

  // Enter avanza al siguiente campo enfocable de toda la sección de
  // productos (SKU → Marca → Pulgada → ...), en vez de intentar enviar el
  // formulario. En el último campo enfocable, agrega una TV nueva.
  const onProductosKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const tag = e.target.tagName
    if (tag !== 'INPUT' && tag !== 'SELECT') return
    e.preventDefault()
    const focosables = Array.from(productosRef.current?.querySelectorAll('input, select') || [])
    const idx = focosables.indexOf(e.target)
    if (idx === -1) return
    if (idx < focosables.length - 1) {
      focosables[idx + 1].focus()
    } else {
      agregarTv()
    }
  }

  const marcasUnicas = useMemo(
    () => new Set(tvs.map((tv) => tv.marca).filter(Boolean)).size,
    [tvs]
  )

  const brandSectionsActuales = useMemo(
    () => groupProductsByBrandAndSize(tvs, groupTargets),
    [tvs, groupTargets]
  )
  const gruposActuales = useMemo(
    () => brandSectionsActuales.flatMap((b) => b.sizes),
    [brandSectionsActuales]
  )
  const metasDefinidasTotal = useMemo(
    () => gruposActuales.reduce((s, g) => s + (isRequestedQuantityDefined(g.requested) ? g.requested : 0), 0),
    [gruposActuales]
  )
  const gruposPorDefinirCount = useMemo(
    () => gruposActuales.filter((g) => !isRequestedQuantityDefined(g.requested)).length,
    [gruposActuales]
  )

  const limite = useMemo(() => {
    const n = Number(cantidadTotal)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [cantidadTotal])

  const pendientePorAsignar = limite > 0 ? Math.max(0, limite - metasDefinidasTotal) : 0
  const excedenteAsignado = limite > 0 ? Math.max(0, metasDefinidasTotal - limite) : 0
  const progresoLimite = limite > 0 ? Math.min(100, Math.round((metasDefinidasTotal / limite) * 100)) : 0

  const updateTv = (i, campo, valor) =>
    setTvs((prev) => prev.map((tv, idx) => (idx === i ? { ...tv, [campo]: valor } : tv)))

  const agregarTv = () => {
    setTvs((prev) => [...prev, tvVacia({
      condiciones: [condicionActiva],
      unidad: palletPorDefecto ? 'pallet' : 'pieza',
    })])
  }
  const eliminarTv = (i) => setTvs((prev) => prev.filter((_, idx) => idx !== i))

  // Duplica una fila completa justo debajo de ella.
  const duplicarTv = (i) => {
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

  // Centraliza duplicar/mover/eliminar/actualizar-campo en un solo callback
  // — EditableProductRow no conoce el arreglo completo, solo su propio
  // índice real (idx = tv._idx, asignado por groupProductsByBrandAndSize).
  const onFilaAccion = (idx, accion, payload) => {
    if (accion === 'update') return updateTv(idx, payload.campo, payload.valor)
    if (accion === 'duplicar') return duplicarTv(idx)
    if (accion === 'moverArriba') return moverArriba(idx)
    if (accion === 'moverAbajo') return moverAbajo(idx)
    if (accion === 'eliminar') return eliminarTv(idx)
  }

  const onCambiarMeta = (groupKey, valor) =>
    setGroupTargets((prev) => ({ ...prev, [groupKey]: valor }))

  // Carga en lote (pegar / Excel / foto). Si lo único que hay es la tarjeta
  // vacía inicial, la reemplaza; si no, agrega. La meta de cantidad sigue
  // siendo por grupo (marca+pulgadas), nunca por SKU individual — pero si
  // el pedido importado ya trae su propio QTY por renglón, se usa para
  // PRELLENAR la meta de cada grupo NUEVO (suma del QTY de los SKU que
  // caen en ese grupo), en vez de dejarla en "por definir": el usuario ya
  // no tiene que volver a capturar a mano un número que la tabla original
  // ya traía. Nunca pisa la meta de un grupo que ya existía antes de este
  // import y que el usuario ya había definido a mano.
  const importarTvs = (items, meta = {}) => {
    if (!items?.length) return

    // Número de pedido y cantidad total: si el propio listado ya los trae
    // (ej. título "PEDIDO #19029407" y la suma de QTY de todos los
    // renglones), se prellenan solos — nunca pisan lo que el usuario ya
    // haya escrito a mano.
    if (meta.numeroPedidoDetectado && !numeroPedido.trim()) {
      setNumeroPedido(meta.numeroPedidoDetectado)
    }
    if (meta.totalPiezas > 0 && !cantidadTotal.trim()) {
      setCantidadTotal(String(meta.totalPiezas))
    }
    const nuevas = items.map((it) => ({
      marca: it.marca,
      pulgadas: it.pulgadas ? String(it.pulgadas) : '',
      // Respeta la condición que trae el propio renglón importado (columna
      // CONDICIÓN del pedido) cuando es válida; si no vino o no es un código
      // reconocido, usa la condición activa del toolbar como antes.
      condiciones: it.condicion && CONDICIONES.includes(it.condicion) ? [it.condicion] : [condicionActiva],
      modelo: it.modelo,
      unidad: palletPorDefecto ? 'pallet' : (it.unidad || 'pieza'),
      modelosAlternativos: it.modelosAlternativos || [],
    }))

    const gruposPrevios = new Set(
      tvs.filter((tv) => tv.marca && tv.pulgadas).map((tv) => createGroupKey(tv.marca, tv.pulgadas))
    )

    setTvs((prev) => {
      const soloVacia = prev.length === 1 && !prev[0].marca && !prev[0].modelo
      return soloVacia ? nuevas : [...prev, ...nuevas]
    })

    const sumaQtyPorGrupo = new Map()
    for (const it of items) {
      if (!it.marca || !it.pulgadas || !(Number(it.cantidad) > 0)) continue
      const key = createGroupKey(it.marca, it.pulgadas)
      sumaQtyPorGrupo.set(key, (sumaQtyPorGrupo.get(key) || 0) + Math.floor(Number(it.cantidad)))
    }
    if (sumaQtyPorGrupo.size > 0) {
      setGroupTargets((prev) => {
        const next = { ...prev }
        for (const [key, suma] of sumaQtyPorGrupo) {
          if (gruposPrevios.has(key) && isRequestedQuantityDefined(prev[key])) continue
          next[key] = suma
        }
        return next
      })
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!numeroPedido.trim()) return setError(t('pedidoForm.numeroFalta'))
    if (!pedidoNombre.trim()) return setError(t('pedidoForm.nombreFalta'))
    if (!fechaLimite) return setError(t('pedidoForm.fechaFalta'))
    if (tvs.length === 0) return setError(t('pedidoForm.agregaAlMenos'))

    for (const [i, tv] of tvs.entries()) {
      if (!marcaValida(tv.marca)) return setError(t('pedidoForm.marcaInvalida', { n: i + 1 }))
      if (!tv.pulgadas) return setError(t('pedidoForm.pulgadasInvalidas', { n: i + 1 }))
      if (!tv.condiciones?.length) return setError(t('pedidoForm.faltaCondicion', { n: i + 1 }))
      if (!SKU_REGEX.test(tv.modelo || '')) {
        return setError(t('pedidoForm.capturaModelo', { n: i + 1 }))
      }
    }

    const televisionesEnvio = tvs.map((tv) => ({
      marca: tv.marca,
      pulgadas: Number(tv.pulgadas),
      condiciones: tv.condiciones,
      modelo: tv.modelo.trim(),
      unidad: tv.unidad === 'pallet' ? 'pallet' : 'pieza',
      sinLimite: true,
      cantidad: 0,
      modelosAlternativos: tv.modelosAlternativos || [],
    }))
    const groupTargetsEnvio = filtrarMetasHuerfanas(groupTargets, televisionesEnvio)

    if (limite > 0 && excedenteAsignado > 0) {
      return setError(t('pedidoForm.metasExcedenTotal', { suma: metasDefinidasTotal, limite }))
    }

    // El pedido ya no pide sus propias "condiciones" por separado — se
    // construyen automáticamente a partir de las condiciones únicas que
    // realmente se usaron en las televisiones capturadas.
    const condicionesUnicas = [...new Set(tvs.flatMap((tv) => tv.condiciones || []))]

    setEnviando(true)
    try {
      await onSubmit({
        numeroPedido: numeroPedido.trim(),
        pedidoNombre: pedidoNombre.trim(),
        fechaLimite,
        condiciones: condicionesUnicas,
        cantidadTotal: limite > 0 ? limite : null,
        televisiones: televisionesEnvio,
        groupTargets: groupTargetsEnvio,
      })
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <main className="pedido-nuevo-page">
      <div className="pedido-nuevo-header">
        <div>
          <h1 className="pedido-nuevo-titulo">{tituloFinal}</h1>
          <p className="pedido-nuevo-subtitulo">{subtituloFinal}</p>
        </div>
        <Link href="/manual" className="btn-ayuda" title={t('pedidoForm.necesitasAyuda')}>
          <IconHelp />
          <span>{t('pedidoForm.necesitasAyuda')}</span>
        </Link>
      </div>

      <form onSubmit={enviar} className="pedido-nuevo-grid">
        <section className="card card-pedido-seccion card-info-general">
          <header className="card-seccion-header">
            <span className="card-seccion-icono"><IconClipboardList /></span>
            <div>
              <h2 className="card-seccion-titulo">{t('pedidoForm.infoGeneral')}</h2>
              <p className="card-seccion-desc">{t('pedidoForm.datosBasePedido')}</p>
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
                placeholder={t('pedidoForm.placeholderNumeroPedido')}
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
                placeholder={t('pedidoForm.placeholderNombrePedido')}
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
                placeholder={t('pedidoForm.placeholderCantidadTotal')}
              />
              {limite > 0 && (
                <div className={`limite-resumen ${excedenteAsignado > 0 ? 'excedido' : (pendientePorAsignar === 0 ? 'lleno' : '')}`}>
                  <div className="limite-info">
                    <span className="limite-numero">
                      {metasDefinidasTotal} <span className="limite-de">{t('pedidoForm.limiteDe')}</span> {limite}
                    </span>
                    <span className="limite-pct">{progresoLimite}%</span>
                  </div>
                  <div className="progreso-track">
                    <div className="progreso-fill" style={{ width: `${progresoLimite}%` }} />
                  </div>
                  {excedenteAsignado > 0 && (
                    <div className="limite-mensaje error">
                      {t('pedidoForm.excedidoPor', { n: excedenteAsignado })}
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
              <h2 className="card-seccion-titulo">{t('pedidoForm.importarPedido')}</h2>
              <p className="card-seccion-desc">{t('pedidoForm.importarDesc')}</p>
            </div>
          </header>
          <ImportarPedidoPanel onImportar={importarTvs} disabled={false} />
        </section>

        <section className="card card-pedido-seccion card-televisiones">
          <header className="card-seccion-header card-televisiones-header">
            <span className="card-seccion-icono"><IconClipboardList /></span>
            <div>
              <h2 className="card-seccion-titulo">{t('pedidoForm.televisiones')}</h2>
              <p className="card-seccion-desc">{t('pedidoForm.televisionesDesc')}</p>
            </div>
            <span className="card-televisiones-contador">
              {t('pedidoForm.contadorTv', { count: tvs.length })}
            </span>
          </header>

          <div className="tv-toolbar">
            <button type="button" onClick={agregarTv} className="btn btn-primary">
              <IconPlus />
              {t('pedidoForm.agregarTelevision')}
            </button>

            <div className="tv-condicion-activa" role="group" aria-label={t('pedidoForm.condicionActivaLabel')}>
              <span className="tv-condicion-activa-label">{t('pedidoForm.condicionActivaLabel')}</span>
              {CONDICIONES_FRECUENTES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} ${condicionActiva === c ? 'activa' : ''}`}
                  onClick={() => setCondicionActiva(c)}
                  aria-pressed={condicionActiva === c}
                  title={t('pedidoForm.condicionTooltip', { c })}
                >
                  <span className="tv-condicion-chip-dot" aria-hidden="true" />
                  {c}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`tv-toolbar-toggle ${palletPorDefecto ? 'activa' : ''}`}
              onClick={() => setPalletPorDefecto((v) => !v)}
              aria-pressed={palletPorDefecto}
              title={t('pedidoForm.palletTooltip')}
            >
              <IconBox />
              {t('pedidoForm.pallet')}
            </button>
          </div>

          <MarcasDatalist id="marcas-list" />

          {tvs.length === 0 ? (
            <div className="empty tv-empty-state">
              <IconClipboardList width={48} height={48} />
              <h3>{t('pedidoForm.sinTelevisiones')}</h3>
              <button type="button" className="btn btn-primary" onClick={agregarTv}>
                <IconPlus /> {t('pedidoForm.agregarPrimera')}
              </button>
            </div>
          ) : (
            <div ref={productosRef} onKeyDown={onProductosKeyDown}>
              <GroupedOrderProducts
                televisiones={tvs}
                metasGrupo={groupTargets}
                mode={initialData ? 'edit' : 'create'}
                onFilaAccion={onFilaAccion}
                onCambiarMeta={onCambiarMeta}
              />
            </div>
          )}
        </section>

        <aside className="card card-pedido-seccion card-resumen-sticky">
          <h2 className="card-seccion-titulo">{t('pedidoForm.resumenPedido')}</h2>

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
            <div className="resumen-fila resumen-fila-grupos">
              <span className="resumen-fila-icono"><IconBox /></span>
              <span className="resumen-fila-label">{t('pedidoForm.grupo.grupos')}</span>
              <strong className="resumen-fila-numero">{gruposActuales.length}</strong>
            </div>
            <div className="resumen-fila resumen-fila-total">
              <span className="resumen-fila-label">{t('pedidoForm.cantidadTotalCorta')}</span>
              <strong className="resumen-fila-numero">{limite > 0 ? limite : '—'}</strong>
            </div>
            <div className="resumen-fila resumen-fila-metas-definidas">
              <span className="resumen-fila-label">{t('pedidoForm.grupo.metasDefinidas')}</span>
              <strong className="resumen-fila-numero">{metasDefinidasTotal}</strong>
            </div>
            <div className="resumen-fila resumen-fila-pendiente-asignar">
              <span className="resumen-fila-label">{t('pedidoForm.grupo.pendientePorAsignar')}</span>
              <strong className="resumen-fila-numero">{limite > 0 ? pendientePorAsignar : '—'}</strong>
            </div>
            {gruposPorDefinirCount > 0 && (
              <div className="resumen-fila resumen-fila-grupos-por-definir">
                <span className="resumen-fila-label">{t('pedidoForm.grupo.gruposPorDefinir')}</span>
                <strong className="resumen-fila-numero">{gruposPorDefinirCount}</strong>
              </div>
            )}
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
