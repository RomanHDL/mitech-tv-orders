'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { estadoLabel, PULGADAS, CONDICIONES, CONDICIONES_FRECUENTES, SKU_REGEX } from '@/lib/catalogos'
import { normalizeOrderStatus } from '@/lib/estado-pedido'
import { localeDe } from '@/lib/intl-format'
import { calculateOrderSummary, flattenGroupedProducts, groupProductsByBrandAndSize } from '@/lib/surtido-grupos'
import ComentariosPedido from '../components/comentarios-pedido'
import GroupedOrderProducts from '../components/grouped-order-products'
import MarcasDatalist from '../components/marcas-datalist'
import StepperEtapas from '../pedidos/stepper-etapas'
import OrderSupplySummary from './order-supply-summary'
import SkuQuickSearch from './sku-quick-search'
import {
  IconAlert,
  IconCheck,
  IconPlus,
  IconPrinter,
} from '../components/icons'

const CONDICIONES_MAS_EXTRA = CONDICIONES.filter((c) => !CONDICIONES_FRECUENTES.includes(c))

function formExtraVacio(pedido) {
  return {
    marca: '',
    pulgadas: '',
    modelo: '',
    condiciones: pedido.condiciones?.length > 0 ? [...pedido.condiciones] : [CONDICIONES_FRECUENTES[0]],
    cantidad: 1,
  }
}

// Próxima etapa accionable — mismo helper que el modal de detalle de /pedidos
// y que la vista standalone de /surtir/[id] (una sola fuente de verdad).
function proximaEtapa(t, estado) {
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO') {
    return { destino: 'CARGANDO', label: t('pedidoDetalle.iniciarCarga') }
  }
  if (estado === 'CARGANDO') return { destino: 'LISTO_SALIDA', label: t('pedidoDetalle.marcarListoSalida') }
  if (estado === 'LISTO_SALIDA') return { destino: 'DESPACHADO', label: t('pedidoDetalle.confirmarDespachoBtn') }
  return null
}

function claveRespaldo(pedidoId) {
  return `surtir_pendientes_${pedidoId}`
}

function leerRespaldo(pedidoId) {
  try {
    const raw = localStorage.getItem(claveRespaldo(pedidoId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function escribirRespaldo(pedidoId, mapa) {
  try {
    if (Object.keys(mapa).length === 0) {
      localStorage.removeItem(claveRespaldo(pedidoId))
    } else {
      localStorage.setItem(claveRespaldo(pedidoId), JSON.stringify(mapa))
    }
  } catch {
    // localStorage puede fallar (modo privado, cuota) — el respaldo es solo
    // una mejora, nunca la fuente de verdad, así que se ignora en silencio.
  }
}

function formatearHora(fecha, lang) {
  return new Intl.DateTimeFormat(localeDe(lang), { hour: '2-digit', minute: '2-digit', hour12: true }).format(fecha)
}

export default function PanelSurtido({ pedido, rol, onCambiado, standalone = false }) {
  const { t, i18n } = useTranslation()
  const [tvs, setTvs] = useState(pedido.televisiones)
  const [pendientesSync, setPendientesSync] = useState(() => new Set())
  const [erroresPorIdx, setErroresPorIdx] = useState(() => new Set())
  const [ultimoGuardado, setUltimoGuardado] = useState(null)
  const [online, setOnline] = useState(true)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [mostrarFormExtra, setMostrarFormExtra] = useState(false)
  const [formExtra, setFormExtra] = useState(() => formExtraVacio(pedido))
  const [masCondicionesExtra, setMasCondicionesExtra] = useState(false)
  const [guardandoExtra, setGuardandoExtra] = useState(false)
  const [errorExtra, setErrorExtra] = useState('')

  const seqPorIdx = useRef({})
  const debounceRef = useRef({})
  const comentariosRef = useRef(null)

  // Reinicia todo el estado local de captura al cambiar de pedido seleccionado.
  useEffect(() => {
    setTvs(pedido.televisiones)
    setPendientesSync(new Set())
    setErroresPorIdx(new Set())
    setUltimoGuardado(null)
    setErrorEstado('')
    setMostrarFormExtra(false)
    setFormExtra(formExtraVacio(pedido))
    setMasCondicionesExtra(false)
    setErrorExtra('')
    seqPorIdx.current = {}
  }, [pedido.id])

  useEffect(() => {
    setOnline(navigator.onLine)
    const marcarOnline = () => setOnline(true)
    const marcarOffline = () => setOnline(false)
    window.addEventListener('online', marcarOnline)
    window.addEventListener('offline', marcarOffline)
    return () => {
      window.removeEventListener('online', marcarOnline)
      window.removeEventListener('offline', marcarOffline)
    }
  }, [])

  // Al montar (o recuperar conexión): si había cambios respaldados en
  // localStorage sin confirmar por el servidor, se aplican y se reintentan.
  useEffect(() => {
    const respaldo = leerRespaldo(pedido.id)
    const idxsPendientes = Object.keys(respaldo).map(Number)
    if (idxsPendientes.length === 0) return
    setTvs((prev) => prev.map((tv, i) => (respaldo[i] !== undefined ? { ...tv, cantidadSurtida: respaldo[i] } : tv)))
    idxsPendientes.forEach((idx) => guardarIdx(idx, respaldo[idx]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id])

  useEffect(() => {
    if (!online) return
    // Al recuperar conexión, reintenta cualquier cambio que haya quedado
    // marcado como pendiente/con error.
    const respaldo = leerRespaldo(pedido.id)
    Object.entries(respaldo).forEach(([idx, valor]) => guardarIdx(Number(idx), valor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  useEffect(() => {
    return () => {
      Object.values(debounceRef.current).forEach((tId) => clearTimeout(tId))
    }
  }, [])

  // Agrupación de dos niveles (marca → pulgadas) — derivada, nunca muta
  // `tvs`. La meta le pertenece al grupo (marca+pulgadas), no a cada SKU;
  // ver lib/surtido-grupos.js para la regla completa (incluye el caso de
  // grupos de un solo SKU y de metas todavía por definir).
  const brandSections = useMemo(
    () => groupProductsByBrandAndSize(tvs, pedido.metasGrupo),
    [tvs, pedido.metasGrupo],
  )
  const orderSummary = useMemo(() => calculateOrderSummary(brandSections), [brandSections])
  // Misma agrupación aplanada — el buscador rápido de SKU opera sobre estos
  // mismos objetos (product._idx apunta al TV real en `tvs`), nunca crea un
  // segundo estado independiente.
  const flatProducts = useMemo(() => flattenGroupedProducts(brandSections), [brandSections])
  const pedidoEtiqueta = pedido.numeroPedido ? `${pedido.pedidoNombre} · ${pedido.numeroPedido}` : pedido.pedidoNombre

  const [highlightedIdx, setHighlightedIdx] = useState(null)
  useEffect(() => {
    if (highlightedIdx === null) return
    const tId = setTimeout(() => setHighlightedIdx(null), 2500)
    return () => clearTimeout(tId)
  }, [highlightedIdx])

  const progreso = orderSummary.totalRequestedDefined > 0
    ? Math.round((orderSummary.totalSuppliedDefined / orderSummary.totalRequestedDefined) * 100)
    : 0
  // Pendiente general = suma del pendiente de cada grupo CON meta definida —
  // nunca resta la suma absoluta de todos los SKU, para que un grupo por
  // definir con piezas ya surtidas no altere el pendiente de los grupos que
  // sí tienen meta real.
  const pendienteCantidad = orderSummary.totalPending

  const estado = normalizeOrderStatus({ progresoPct: progreso, estadoOperativo: pedido.estadoOperativo })
  const esAdmin = rol === 'admin'
  const esSurtidor = rol === 'surtidor'
  const siguienteEtapa = proximaEtapa(t, estado)
  // "Iniciar carga" y "Cancelar pedido" son exclusivas de admin (regla de
  // negocio explícita); el resto de transiciones (listo para salida,
  // despacho) las sigue pudiendo mover el surtidor, igual que antes.
  const puedeIniciarSiguienteEtapa =
    siguienteEtapa && (siguienteEtapa.destino === 'CARGANDO' ? esAdmin : (esAdmin || esSurtidor))
  const puedeCancelar = esAdmin && estado !== 'DESPACHADO' && estado !== 'CANCELADO'

  const hayError = erroresPorIdx.size > 0
  const hayPendiente = pendientesSync.size > 0
  const estadoGlobal = !online ? 'sinconexion' : hayError ? 'error' : hayPendiente ? 'guardando' : 'guardado'

  // Guarda el valor de un renglón contra el servidor. Se usa tanto para
  // acciones inmediatas (+/-/completar/reiniciar) como al vencer el
  // debounce de una edición manual. Protegido contra condiciones de carrera:
  // si llega una respuesta de una petición vieja (seq desactualizado), se
  // ignora por completo — nunca pisa un valor más nuevo en pantalla.
  const guardarIdx = useCallback((idx, valor) => {
    const miSeq = (seqPorIdx.current[idx] || 0) + 1
    seqPorIdx.current[idx] = miSeq

    setPendientesSync((prev) => new Set(prev).add(idx))
    setErroresPorIdx((prev) => { const n = new Set(prev); n.delete(idx); return n })

    const respaldo = leerRespaldo(pedido.id)
    respaldo[idx] = valor
    escribirRespaldo(pedido.id, respaldo)

    if (!navigator.onLine) {
      // Sin conexión: el cambio queda respaldado localmente y marcado como
      // pendiente; se reintenta solo cuando vuelva la conexión (listener de
      // arriba), nunca se pierde ni se descarta.
      return
    }

    fetch(`/api/pedidos/${pedido.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvIndex: idx, cantidadSurtida: valor }),
    })
      .then(async (res) => {
        if (seqPorIdx.current[idx] !== miSeq) return // superada por otra petición más nueva
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || t('surtir.errorGuardar'))
        }
        setPendientesSync((prev) => { const n = new Set(prev); n.delete(idx); return n })
        setErroresPorIdx((prev) => { const n = new Set(prev); n.delete(idx); return n })
        const actual = leerRespaldo(pedido.id)
        delete actual[idx]
        escribirRespaldo(pedido.id, actual)
        setUltimoGuardado(new Date())
      })
      .catch(() => {
        if (seqPorIdx.current[idx] !== miSeq) return
        setErroresPorIdx((prev) => new Set(prev).add(idx))
      })
  }, [pedido.id, t])

  // Ref espejo de `tvs` para que `actualizar` (memoizado con deps estables)
  // siempre lea el valor más reciente sin tener que reconstruirse.
  const tvsRef = useRef(tvs)
  tvsRef.current = tvs

  // Actualización optimista: cambia la pantalla de inmediato; el guardado
  // real es inmediato para los botones, o con debounce (700-1000ms)
  // para edición manual de texto, para no disparar una petición por tecla.
  const actualizar = useCallback((idx, valorBruto, opciones = {}) => {
    const tv = tvsRef.current[idx]
    if (!tv) return
    const limiteTv = tv.sinLimite ? Infinity : tv.cantidad
    const valor = Math.max(0, Math.min(limiteTv, Number(valorBruto) || 0))
    const valorAnterior = tv.cantidadSurtida || 0
    if (valor === valorAnterior && !opciones.forzar) return

    setTvs((prev) => prev.map((t, i) => (i === idx ? { ...t, cantidadSurtida: valor } : t)))

    if (opciones.inmediato) {
      clearTimeout(debounceRef.current[idx])
      guardarIdx(idx, valor)
    } else {
      setPendientesSync((prev) => new Set(prev).add(idx))
      clearTimeout(debounceRef.current[idx])
      debounceRef.current[idx] = setTimeout(() => guardarIdx(idx, valor), 800)
    }
  }, [guardarIdx])

  async function avanzarEtapa(destino) {
    setErrorEstado('')
    let razon = null
    if (destino === 'DESPACHADO') {
      if (!confirm(t('pedidoDetalle.confirmarDespacho'))) return
      if (pendienteCantidad > 0) {
        if (rol !== 'admin') {
          setErrorEstado(t('pedidoDetalle.noDespacharPendiente'))
          return
        }
        razon = window.prompt(t('pedidoDetalle.razonDespachoPendiente'))
        if (!razon || !razon.trim()) return
      }
    }
    if (destino === 'CANCELADO' && !confirm(t('pedidoDetalle.confirmarCancelar'))) return

    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: destino, razon }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('pedidoDetalle.errorCambiarEstado'))
      }
      onCambiado?.()
    } catch (err) {
      setErrorEstado(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  function guardarProgresoManual() {
    // Respaldo manual: fuerza el guardado inmediato de cualquier cambio
    // pendiente (los que aún esperaban el debounce) y reintenta los que
    // hayan fallado. Nunca crea un registro nuevo, solo re-envía el valor
    // actual de cada renglón pendiente.
    Object.keys(debounceRef.current).forEach((idx) => clearTimeout(debounceRef.current[idx]))
    const idxsAtender = new Set([...pendientesSync, ...erroresPorIdx])
    idxsAtender.forEach((idx) => guardarIdx(idx, tvsRef.current[idx].cantidadSurtida))
    comentariosRef.current?.guardarAhora()
  }

  function toggleCondicionExtra(c) {
    setFormExtra((prev) => {
      const activa = prev.condiciones.includes(c)
      const condiciones = activa ? prev.condiciones.filter((x) => x !== c) : [...prev.condiciones, c]
      return { ...prev, condiciones }
    })
  }

  // Agrega un renglón para un SKU que no venía en la lista original del
  // pedido (usado cuando ya se surtieron TVs de un modelo no cargado). Se
  // guarda como surtido de inmediato porque las piezas ya se usaron.
  async function agregarSkuExtra() {
    setErrorExtra('')
    const modelo = formExtra.modelo.trim().toUpperCase()
    if (!formExtra.marca) return setErrorExtra(t('pedidoForm.marcaInvalida', { n: 1 }))
    if (!PULGADAS.includes(Number(formExtra.pulgadas))) return setErrorExtra(t('pedidoForm.pulgadasInvalidas', { n: 1 }))
    if (!SKU_REGEX.test(modelo)) return setErrorExtra(t('pedidoForm.capturaModelo', { n: 1 }))
    if (formExtra.condiciones.length === 0) return setErrorExtra(t('pedidoForm.faltaCondicion', { n: 1 }))
    const cantidad = Number(formExtra.cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) return setErrorExtra(t('pedidoForm.cantidadInvalida', { n: 1 }))

    if (!confirm(t('surtir.confirmarAgregarSku', { cantidad, sku: modelo }))) return

    setGuardandoExtra(true)
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/agregar-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marca: formExtra.marca, pulgadas: Number(formExtra.pulgadas), modelo, condiciones: formExtra.condiciones, cantidad }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('surtir.errorAgregarSku'))

      setTvs((prev) => [...prev, data.tv])
      setFormExtra(formExtraVacio(pedido))
      setMasCondicionesExtra(false)
      setMostrarFormExtra(false)
      setUltimoGuardado(new Date())
    } catch (err) {
      setErrorExtra(err.message)
    } finally {
      setGuardandoExtra(false)
    }
  }

  const hayCambiosSinSincronizar = pendientesSync.size > 0 || erroresPorIdx.size > 0
  const puedeFinalizar = pendienteCantidad === 0 && !hayCambiosSinSincronizar
  let motivoBloqueoFinalizar = ''
  if (pendienteCantidad > 0) motivoBloqueoFinalizar = t('surtir.noFinalizarFaltan', { n: pendienteCantidad })
  else if (hayCambiosSinSincronizar) motivoBloqueoFinalizar = t('surtir.esperaGuardado')

  async function finalizarSurtido() {
    if (!puedeFinalizar) {
      alert(motivoBloqueoFinalizar)
      return
    }
    if (!confirm(t('surtir.confirmarFinalizar'))) return
    setFinalizando(true)
    try {
      // El estado ya es "TERMINADO" automáticamente al llegar a 100% (se
      // deriva y se registra en la bitácora desde el mismo PATCH de
      // surtido) — esta acción solo confirma y refresca la vista, nunca
      // marca el pedido como Cargando/Despachado.
      onCambiado?.()
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div className="panel-surtido">
      <div className="panel-surtido-header">
        <div className="panel-surtido-titulo-fila">
          <h2>
            {pedido.pedidoNombre}
            {pedido.numeroPedido && <span className="panel-surtido-numero">#{pedido.numeroPedido}</span>}
          </h2>
          {standalone && (
            <Link href={`/pedidos/${pedido.id}/imprimir`} className="btn btn-secondary btn-sm">
              <IconPrinter /> {t('common.imprimir')}
            </Link>
          )}
        </div>
        <div className="panel-surtido-meta">
          <span>{t('surtir.solicitadoPor')} <strong>{pedido.creadoPorNombre || '—'}</strong></span>
          {pedido.condiciones.length > 0 && (
            <span className="panel-surtido-meta-condicion">
              {t('surtir.condicionDosPuntos')}
              {pedido.condiciones.map((c) => <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>)}
            </span>
          )}
          <span className={`badge-estado-op estado-${estado.toLowerCase().replace('_', '-')}`}>{estadoLabel(t, estado)}</span>
          {pedido.fechaLimite && <span className="chip-fecha-limite">{t('surtir.limiteFecha', { fecha: formatearFechaLimiteCorta(pedido.fechaLimite, i18n.language) })}</span>}
        </div>
      </div>

      <div className="pedido-ciclo">
        <StepperEtapas estado={estado} />
        {(puedeIniciarSiguienteEtapa || puedeCancelar) && (
          <div className="pedido-ciclo-acciones">
            {puedeIniciarSiguienteEtapa && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => avanzarEtapa(siguienteEtapa.destino)} disabled={cambiandoEstado}>
                {siguienteEtapa.label}
              </button>
            )}
            {puedeCancelar && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => avanzarEtapa('CANCELADO')} disabled={cambiandoEstado}>
                {t('pedidoDetalle.cancelarPedido')}
              </button>
            )}
          </div>
        )}
        {errorEstado && <div className="alerta alerta-error"><span>{errorEstado}</span></div>}
      </div>

      <div className="barra-autoguardado">
        <span className="barra-autoguardado-icono"><IconCheck /></span>
        <div className="barra-autoguardado-texto">
          <strong>{t('surtir.autoguardadoActivado')}</strong>
          <span>{t('surtir.autoguardadoDesc')}</span>
        </div>
        <span className={`badge-autoguardado estado-${estadoGlobal}`}>
          {estadoGlobal === 'guardando' && t('common.guardando')}
          {estadoGlobal === 'guardado' && t('surtir.guardado')}
          {estadoGlobal === 'error' && t('surtir.errorAlGuardar')}
          {estadoGlobal === 'sinconexion' && t('surtir.sinConexion')}
        </span>
        <span className="barra-autoguardado-hora">
          {ultimoGuardado ? t('surtir.ultimoGuardado', { hora: formatearHora(ultimoGuardado, i18n.language) }) : t('surtir.sinGuardados')}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={guardarProgresoManual}>
          {t('surtir.guardarProgreso')}
        </button>
      </div>

      <OrderSupplySummary orderSummary={orderSummary} />

      <ComentariosPedido
        ref={comentariosRef}
        pedidoId={pedido.id}
        comentariosIniciales={pedido.comentarios || ''}
        actualizadoIso={pedido.comentariosActualizado}
        actualizadoPorNombre={pedido.comentariosActualizadoPorNombre}
        titulo={t('surtir.comentariosPedidoTitulo')}
        placeholder={t('surtir.comentariosPedidoPlaceholder')}
      />

      <SkuQuickSearch
        products={flatProducts}
        onActualizar={actualizar}
        onEncontrado={setHighlightedIdx}
        pedidoEtiqueta={pedidoEtiqueta}
      />

      <GroupedOrderProducts
        televisiones={tvs}
        metasGrupo={pedido.metasGrupo}
        mode="supply"
        onActualizar={actualizar}
        highlightedIdx={highlightedIdx}
      />

      <div className="bloque-sku-extra">
        {!mostrarFormExtra ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-agregar-sku-extra"
            onClick={() => setMostrarFormExtra(true)}
          >
            <IconAlert /> {t('surtir.agregarSkuUltimoMomento')}
          </button>
        ) : (
          <div className="form-sku-extra">
            <div className="form-sku-extra-header">
              <strong><IconAlert /> {t('surtir.agregarSkuUltimoMomento')}</strong>
              <p>{t('surtir.agregarSkuUltimoMomentoDesc')}</p>
            </div>

            <MarcasDatalist id="marcas-list-extra" />

            <div className="form-sku-extra-campos">
              <label className="label">
                {t('pedidoForm.colSkuModelo')}
                <input
                  type="text"
                  value={formExtra.modelo}
                  onChange={(e) => setFormExtra((p) => ({ ...p, modelo: e.target.value }))}
                  placeholder={t('pedidoForm.colSkuModelo')}
                  minLength={3}
                  maxLength={20}
                />
              </label>
              <label className="label">
                {t('common.marca')}
                <input
                  list="marcas-list-extra"
                  value={formExtra.marca}
                  onChange={(e) => setFormExtra((p) => ({ ...p, marca: e.target.value }))}
                  placeholder={t('common.marca')}
                />
              </label>
              <label className="label">
                {t('pedidoForm.colPulgada')}
                <select
                  value={formExtra.pulgadas}
                  onChange={(e) => setFormExtra((p) => ({ ...p, pulgadas: e.target.value }))}
                >
                  <option value="">—</option>
                  {PULGADAS.map((p) => (
                    <option key={p} value={p}>{p}&quot;</option>
                  ))}
                </select>
              </label>
              <label className="label">
                {t('pedidoForm.colCantidad')}
                <input
                  type="number"
                  min="1"
                  value={formExtra.cantidad}
                  onChange={(e) => setFormExtra((p) => ({ ...p, cantidad: e.target.value }))}
                />
              </label>
            </div>

            <div className="form-sku-extra-condiciones">
              <span className="label">{t('pedidoForm.condicion')}</span>
              <div className="tv-condicion-chips">
                {CONDICIONES_FRECUENTES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tv-condicion-chip ${formExtra.condiciones.includes(c) ? 'activa' : ''}`}
                    onClick={() => toggleCondicionExtra(c)}
                  >
                    {c}
                  </button>
                ))}
                {masCondicionesExtra && CONDICIONES_MAS_EXTRA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tv-condicion-chip ${formExtra.condiciones.includes(c) ? 'activa' : ''}`}
                    onClick={() => toggleCondicionExtra(c)}
                  >
                    {c}
                  </button>
                ))}
                {!masCondicionesExtra && (
                  <button type="button" className="tag-mas" onClick={() => setMasCondicionesExtra(true)}>
                    {t('pedidoForm.masCondicionesCorto')}
                  </button>
                )}
              </div>
            </div>

            {errorExtra && <div className="alerta alerta-error"><span>{errorExtra}</span></div>}

            <div className="form-sku-extra-acciones">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setMostrarFormExtra(false); setErrorExtra(''); setFormExtra(formExtraVacio(pedido)) }}
                disabled={guardandoExtra}
              >
                {t('common.cancelar')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={agregarSkuExtra}
                disabled={guardandoExtra}
              >
                <IconPlus /> {guardandoExtra ? t('common.guardando') : t('surtir.agregarSkuBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="barra-sticky-surtido">
        <div className="barra-sticky-izquierda">
          <span className="barra-sticky-titulo">{t('surtir.autoguardadoActivado')}</span>
          <span className="barra-sticky-hora">{ultimoGuardado ? t('surtir.ultimoGuardado', { hora: formatearHora(ultimoGuardado, i18n.language) }) : '—'}</span>
          <span className={`badge-autoguardado estado-${estadoGlobal}`}>
            {estadoGlobal === 'guardando' && t('common.guardando')}
            {estadoGlobal === 'guardado' && t('surtir.guardado')}
            {estadoGlobal === 'error' && t('surtir.errorAlGuardar')}
            {estadoGlobal === 'sinconexion' && t('surtir.sinConexion')}
          </span>
        </div>
        <div className="barra-sticky-derecha">
          <button type="button" className="btn btn-secondary" onClick={guardarProgresoManual}>
            {t('surtir.guardarProgreso')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={finalizarSurtido}
            disabled={!puedeFinalizar || finalizando}
            title={puedeFinalizar ? t('surtir.finalizarSurtido') : motivoBloqueoFinalizar}
          >
            <IconCheck /> {t('surtir.finalizarSurtido')}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatearFechaLimiteCorta(iso, lang) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d))
}
