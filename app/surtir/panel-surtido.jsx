'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { unidadLabel, estadoLabel, MARCAS, PULGADAS, CONDICIONES, CONDICIONES_FRECUENTES, SKU_REGEX } from '@/lib/catalogos'
import { normalizeOrderStatus } from '@/lib/estado-pedido'
import { localeDe } from '@/lib/intl-format'
import ComentariosPedido from '../components/comentarios-pedido'
import StepperEtapas from '../pedidos/stepper-etapas'
import {
  IconAlert,
  IconCheck,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconRefresh,
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

  const grupos = useMemo(() => {
    const mapa = {}
    tvs.forEach((tv, idx) => {
      if (!mapa[tv.marca]) mapa[tv.marca] = []
      mapa[tv.marca].push({ ...tv, _idx: idx })
    })
    return Object.keys(mapa).sort().map((marca) => ({
      marca,
      items: mapa[marca].sort((a, b) => a.pulgadas - b.pulgadas),
    }))
  }, [tvs])

  const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
  const totalRequerido =
    typeof pedido.cantidadTotal === 'number' && pedido.cantidadTotal > 0
      ? pedido.cantidadTotal
      : sumaCantidades
  const totalSurtido = tvs.reduce((s, tv) => {
    const surt = tv.cantidadSurtida || 0
    if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + surt
    return s + Math.min(tv.cantidad || 0, surt)
  }, 0)
  const progreso = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
  const pendienteCantidad = Math.max(0, totalRequerido - totalSurtido)

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

      <div className="resumen-surtido">
        <div className="resumen-surtido-progreso">
          <div className="resumen-surtido-titulo-fila">
            <span>{t('surtir.piezasSurtidas', { surt: totalSurtido, req: totalRequerido })}</span>
            <span className="resumen-surtido-pct">{progreso}%</span>
          </div>
          <div className="progreso-track">
            <div className={`progreso-fill ${progreso >= 100 ? 'completa' : ''}`} style={{ width: `${Math.min(100, progreso)}%` }} />
          </div>
        </div>
        <div className="resumen-surtido-cifras">
          <div className="resumen-cifra resumen-solicitadas">
            <span className="dato-label">{t('surtir.solicitadas')}</span>
            <span className="dato-valor-grande">{totalRequerido}</span>
          </div>
          <div className="resumen-cifra resumen-surtidas">
            <span className="dato-label">{t('surtir.surtidas')}</span>
            <span className="dato-valor-grande">{totalSurtido}</span>
          </div>
          <div className="resumen-cifra resumen-pendientes">
            <span className="dato-label">{t('surtir.pendientes2')}</span>
            <span className="dato-valor-grande">{pendienteCantidad}</span>
          </div>
        </div>
      </div>

      <ComentariosPedido
        ref={comentariosRef}
        pedidoId={pedido.id}
        comentariosIniciales={pedido.comentarios || ''}
        actualizadoIso={pedido.comentariosActualizado}
        actualizadoPorNombre={pedido.comentariosActualizadoPorNombre}
        titulo={t('surtir.comentariosPedidoTitulo')}
        placeholder={t('surtir.comentariosPedidoPlaceholder')}
      />

      <div className="filas-surtido">
        <div className="fila-surtido-cabecera">
          <span>{t('surtir.colProducto')}</span>
          <span>{t('common.solicitado')} · {t('common.surtido')} · {t('common.pendiente')}</span>
          <span>{t('surtir.colCantidad')}</span>
          <span>{t('surtir.colAccion')}</span>
        </div>
        {grupos.map(({ items }) => items.map((tv) => {
          const idx = tv._idx
          const esSinLimite = !!tv.sinLimite
          const surtida = esSinLimite ? (tv.cantidadSurtida || 0) : Math.min(tv.cantidad, tv.cantidadSurtida || 0)
          const pendienteTv = esSinLimite ? null : Math.max(0, tv.cantidad - surtida)
          const pctTv = esSinLimite ? null : (tv.cantidad > 0 ? Math.round((surtida / tv.cantidad) * 100) : 0)
          const completo = !esSinLimite && surtida >= tv.cantidad
          const enProgreso = surtida > 0 && !completo
          const claseFila = completo ? 'fila-surtido-completo' : enProgreso ? 'fila-surtido-parcial' : 'fila-surtido-pendiente'
          const claseProgreso = completo ? 'completa' : enProgreso ? 'avanzando' : ''
          const condTv = tv.condiciones?.join(' ') || ''
          const descTv = `${tv.marca} ${tv.pulgadas}"${condTv ? ' ' + condTv : ''}${tv.modelo ? ' ' + tv.modelo : ''}`
          const unidadTxt = unidadLabel(t, tv.cantidad || 1, tv.unidad)

          return (
            <div key={idx} className={`fila-surtido-fila ${claseFila}`}>
              <div className="fila-surtido-producto">
                <div className="fila-surtido-top">
                  <span className="fila-surtido-marca">{tv.marca}</span>
                  <span className="fila-surtido-pulgadas">{tv.pulgadas}&quot;</span>
                  {tv.esUltimoMomento && (
                    <span className="tag tag-extra" title={t('surtir.tagUltimoMomentoTitle')}>
                      <IconAlert width={11} height={11} /> {t('surtir.tagUltimoMomento')}
                    </span>
                  )}
                  {tv.condiciones?.map((c) => (
                    <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
                  ))}
                  <span className={`fila-surtido-pct ${claseProgreso}`}>
                    {pctTv === null ? '—' : `${pctTv}%`}
                  </span>
                </div>
                {pctTv !== null && (
                  <div className="fila-surtido-bar">
                    <div className={`fila-surtido-bar-fill ${claseProgreso}`} style={{ width: `${pctTv}%` }} />
                  </div>
                )}
                <div className="fila-surtido-sub">
                  <span>{t('surtir.modeloEtiqueta')} <b>{tv.modelo || '—'}</b></span>
                  <span>· {t('surtir.skuEtiqueta')} <b>{tv.modelo || '—'}</b></span>
                  {tv.modelosAlternativos?.length > 0 && (
                    <span className="tv-alt-hint">
                      {t('common.tambienValido', { lista: tv.modelosAlternativos.join(', ') })}
                    </span>
                  )}
                </div>
              </div>

              <div className="fila-surtido-controles">
                <div className="fila-surtido-metricas">
                  <div className="fila-surtido-metrica">
                    <span className="fila-surtido-metrica-label">{t('common.solicitado')}</span>
                    <span className="fila-surtido-metrica-valor">{esSinLimite ? t('pedidoForm.sinLimite') : tv.cantidad}</span>
                  </div>
                  <div className="fila-surtido-metrica">
                    <span className="fila-surtido-metrica-label">{t('common.surtido')}</span>
                    <span className="fila-surtido-metrica-valor ok">{surtida}</span>
                  </div>
                  <div className="fila-surtido-metrica">
                    <span className="fila-surtido-metrica-label">{t('common.pendiente')}</span>
                    <span className="fila-surtido-metrica-valor warn">{pendienteTv === null ? '—' : pendienteTv}</span>
                  </div>
                </div>

                <div className="stepper-cantidad">
                  <button
                    type="button"
                    onClick={() => actualizar(idx, surtida - 1, { inmediato: true })}
                    disabled={surtida === 0}
                    aria-label={t('surtir.restarUno')}
                    title={t('surtir.restarUno')}
                  >
                    <IconMinus />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={esSinLimite ? undefined : tv.cantidad}
                    value={surtida}
                    onChange={(e) => actualizar(idx, e.target.value, { descripcion: descTv })}
                    aria-label={t('surtir.cantidadSurtidaLabel')}
                    className="stepper-cantidad-input"
                  />
                  <button
                    type="button"
                    onClick={() => actualizar(idx, surtida + 1, { inmediato: true })}
                    disabled={completo}
                    aria-label={t('surtir.sumarUno')}
                    title={t('surtir.sumarUno')}
                  >
                    <IconPlus />
                  </button>
                </div>

                <div className="fila-surtido-acciones">
                  <button
                    type="button"
                    className="btn-mini-action btn-listo"
                    onClick={() => {
                      if (esSinLimite) return
                      if (confirm(t('surtir.confirmarMarcarSurtidas', { cantidad: tv.cantidad - surtida, unidad: unidadTxt, desc: descTv }))) {
                        actualizar(idx, tv.cantidad, { inmediato: true })
                      }
                    }}
                    disabled={completo || esSinLimite}
                    aria-label={t('surtir.completar')}
                    title={t('surtir.completarTitle')}
                  >
                    <IconCheck />
                  </button>
                  <button
                    type="button"
                    className="btn-mini-action btn-reset"
                    onClick={() => {
                      if (confirm(t('surtir.confirmarRestablecer'))) {
                        actualizar(idx, 0, { inmediato: true })
                      }
                    }}
                    disabled={surtida === 0}
                    aria-label={t('surtir.reiniciar')}
                    title={t('surtir.restablecerA0')}
                  >
                    <IconRefresh />
                  </button>
                </div>
              </div>
            </div>
          )
        }))}
      </div>

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

            <datalist id="marcas-list-extra">
              {MARCAS.map((m) => <option key={m} value={m} />)}
            </datalist>

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
