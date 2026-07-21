'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { unidadLabel, ESTADO_LABEL } from '@/lib/catalogos'
import { normalizeOrderStatus } from '@/lib/estado-pedido'
import ComentariosPedido from '../components/comentarios-pedido'
import StepperEtapas from '../pedidos/stepper-etapas'
import {
  IconAlert,
  IconCheck,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconScan,
} from '../components/icons'

// Próxima etapa accionable — mismo helper que el modal de detalle de /pedidos
// y que la vista standalone de /surtir/[id] (una sola fuente de verdad).
function proximaEtapa(estado) {
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO') {
    return { destino: 'CARGANDO', label: 'Iniciar carga' }
  }
  if (estado === 'CARGANDO') return { destino: 'LISTO_SALIDA', label: 'Marcar listo para salida' }
  if (estado === 'LISTO_SALIDA') return { destino: 'DESPACHADO', label: 'Confirmar despacho' }
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

function formatearHora(fecha) {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).format(fecha)
}

export default function PanelSurtido({ pedido, rol, onCambiado, standalone = false }) {
  const { t } = useTranslation()
  const [tvs, setTvs] = useState(pedido.televisiones)
  const [pendientesSync, setPendientesSync] = useState(() => new Set())
  const [erroresPorIdx, setErroresPorIdx] = useState(() => new Set())
  const [ultimoGuardado, setUltimoGuardado] = useState(null)
  const [online, setOnline] = useState(true)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const [codigoScan, setCodigoScan] = useState('')
  const [mensajeScan, setMensajeScan] = useState(null) // { tipo: 'ok'|'error', texto }
  const [finalizando, setFinalizando] = useState(false)

  const seqPorIdx = useRef({})
  const debounceRef = useRef({})
  const scanInputRef = useRef(null)
  const scanMensajeTimeout = useRef(null)

  // Reinicia todo el estado local de captura al cambiar de pedido seleccionado.
  useEffect(() => {
    setTvs(pedido.televisiones)
    setPendientesSync(new Set())
    setErroresPorIdx(new Set())
    setUltimoGuardado(null)
    setErrorEstado('')
    setMensajeScan(null)
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
      clearTimeout(scanMensajeTimeout.current)
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
  const puedeAvanzarEtapa = rol === 'admin' || rol === 'surtidor'
  const siguienteEtapa = proximaEtapa(estado)
  const puedeCancelar = estado !== 'DESPACHADO' && estado !== 'CANCELADO'

  const hayError = erroresPorIdx.size > 0
  const hayPendiente = pendientesSync.size > 0
  const estadoGlobal = !online ? 'sinconexion' : hayError ? 'error' : hayPendiente ? 'guardando' : 'guardado'

  // Guarda el valor de un renglón contra el servidor. Se usa tanto para
  // acciones inmediatas (+/-/completar/reiniciar/escaneo) como al vencer el
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
          throw new Error(data.error || 'No se pudo guardar')
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
  }, [pedido.id])

  // Ref espejo de `tvs` para que `actualizar` (memoizado con deps estables)
  // siempre lea el valor más reciente sin tener que reconstruirse.
  const tvsRef = useRef(tvs)
  tvsRef.current = tvs

  // Actualización optimista: cambia la pantalla de inmediato; el guardado
  // real es inmediato para botones/escaneo, o con debounce (700-1000ms)
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
      if (!confirm('¿Confirmas que este pedido ya salió de las instalaciones?')) return
      if (pendienteCantidad > 0) {
        if (rol !== 'admin') {
          setErrorEstado('No se puede despachar con unidades pendientes.')
          return
        }
        razon = window.prompt('Este pedido tiene unidades pendientes. Escribe la razón para despachar de todos modos:')
        if (!razon || !razon.trim()) return
      }
    }
    if (destino === 'CANCELADO' && !confirm('¿Confirmas que quieres cancelar este pedido?')) return

    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: destino, razon }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo cambiar el estado')
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
  }

  function mostrarMensajeScan(tipo, texto) {
    clearTimeout(scanMensajeTimeout.current)
    setMensajeScan({ tipo, texto })
    scanMensajeTimeout.current = setTimeout(() => setMensajeScan(null), 4500)
  }

  function procesarEscaneo(codigoBruto) {
    const codigo = codigoBruto.trim()
    if (!codigo) return
    const buscado = codigo.toUpperCase()
    const idx = tvsRef.current.findIndex((tv) => {
      if ((tv.modelo || '').toUpperCase() === buscado) return true
      return (tv.modelosAlternativos || []).some((m) => (m || '').toUpperCase() === buscado)
    })

    if (idx === -1) {
      mostrarMensajeScan('error', 'Este código no pertenece al pedido seleccionado.')
    } else {
      const tv = tvsRef.current[idx]
      const surtida = tv.cantidadSurtida || 0
      if (!tv.sinLimite && surtida >= tv.cantidad) {
        mostrarMensajeScan('error', `Ya se surtió la cantidad solicitada de ${tv.marca} ${tv.pulgadas}" (${tv.modelo}).`)
      } else {
        actualizar(idx, surtida + 1, { inmediato: true })
        mostrarMensajeScan('ok', `${codigo} agregado correctamente`)
      }
    }

    setCodigoScan('')
    scanInputRef.current?.focus()
  }

  function onSubmitScan(e) {
    e.preventDefault()
    procesarEscaneo(codigoScan)
  }

  const hayCambiosSinSincronizar = pendientesSync.size > 0 || erroresPorIdx.size > 0
  const puedeFinalizar = pendienteCantidad === 0 && !hayCambiosSinSincronizar
  let motivoBloqueoFinalizar = ''
  if (pendienteCantidad > 0) motivoBloqueoFinalizar = `No puedes finalizar el surtido. Aún faltan ${pendienteCantidad} piezas.`
  else if (hayCambiosSinSincronizar) motivoBloqueoFinalizar = 'Espera a que los cambios terminen de guardarse.'

  async function finalizarSurtido() {
    if (!puedeFinalizar) {
      alert(motivoBloqueoFinalizar)
      return
    }
    if (!confirm('¿Confirmas que el surtido de este pedido está completo y quieres finalizarlo?')) return
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
          <span>Solicitado por: <strong>{pedido.creadoPorNombre || '—'}</strong></span>
          {pedido.condiciones.length > 0 && (
            <span className="panel-surtido-meta-condicion">
              Condición:
              {pedido.condiciones.map((c) => <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>)}
            </span>
          )}
          <span className={`badge-estado-op estado-${estado.toLowerCase().replace('_', '-')}`}>{ESTADO_LABEL[estado]}</span>
          {pedido.fechaLimite && <span className="chip-fecha-limite">Límite: {formatearFechaLimiteCorta(pedido.fechaLimite)}</span>}
        </div>
      </div>

      <div className="pedido-ciclo">
        <StepperEtapas estado={estado} />
        {puedeAvanzarEtapa && (siguienteEtapa || puedeCancelar) && (
          <div className="pedido-ciclo-acciones">
            {siguienteEtapa && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => avanzarEtapa(siguienteEtapa.destino)} disabled={cambiandoEstado}>
                {siguienteEtapa.label}
              </button>
            )}
            {puedeCancelar && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => avanzarEtapa('CANCELADO')} disabled={cambiandoEstado}>
                Cancelar pedido
              </button>
            )}
          </div>
        )}
        {errorEstado && <div className="alerta alerta-error"><span>{errorEstado}</span></div>}
      </div>

      <div className="barra-autoguardado">
        <span className="barra-autoguardado-icono"><IconCheck /></span>
        <div className="barra-autoguardado-texto">
          <strong>Guardado automático activado</strong>
          <span>Los cambios se guardan automáticamente.</span>
        </div>
        <span className={`badge-autoguardado estado-${estadoGlobal}`}>
          {estadoGlobal === 'guardando' && 'Guardando…'}
          {estadoGlobal === 'guardado' && 'Guardado'}
          {estadoGlobal === 'error' && 'Error al guardar'}
          {estadoGlobal === 'sinconexion' && 'Sin conexión'}
        </span>
        <span className="barra-autoguardado-hora">
          {ultimoGuardado ? `Último guardado: ${formatearHora(ultimoGuardado)}` : 'Sin cambios guardados aún'}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={guardarProgresoManual}>
          Guardar progreso
        </button>
      </div>

      <div className="resumen-surtido">
        <div className="resumen-surtido-progreso">
          <div className="resumen-surtido-titulo-fila">
            <span>{totalSurtido} de {totalRequerido} piezas surtidas</span>
            <span className="resumen-surtido-pct">{progreso}%</span>
          </div>
          <div className="progreso-track">
            <div className={`progreso-fill ${progreso >= 100 ? 'completa' : ''}`} style={{ width: `${Math.min(100, progreso)}%` }} />
          </div>
        </div>
        <div className="resumen-surtido-cifras">
          <div className="resumen-cifra resumen-solicitadas">
            <span className="dato-label">Solicitadas</span>
            <span className="dato-valor-grande">{totalRequerido}</span>
          </div>
          <div className="resumen-cifra resumen-surtidas">
            <span className="dato-label">Surtidas</span>
            <span className="dato-valor-grande">{totalSurtido}</span>
          </div>
          <div className="resumen-cifra resumen-pendientes">
            <span className="dato-label">Pendientes</span>
            <span className="dato-valor-grande">{pendienteCantidad}</span>
          </div>
        </div>
      </div>

      <form className="escaner-surtido" onSubmit={onSubmitScan}>
        <label htmlFor="escaner-input"><IconScan /> Escanear SKU, LPN o código de barras</label>
        <div className="escaner-surtido-fila">
          <input
            id="escaner-input"
            ref={scanInputRef}
            type="text"
            placeholder="Escanea o ingresa el código…"
            value={codigoScan}
            onChange={(e) => setCodigoScan(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary">Agregar</button>
        </div>
        {mensajeScan && (
          <div className={`escaner-mensaje escaner-mensaje-${mensajeScan.tipo}`}>
            {mensajeScan.tipo === 'error' && <IconAlert width={14} height={14} />}
            {mensajeScan.texto}
          </div>
        )}
      </form>

      <div className="tabla-wrap">
        <table className="tabla-pedidos tabla-pedidos-densa tabla-surtido">
          <thead>
            <tr>
              <th>SKU/LPN</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Pulgadas</th>
              <th>Condición</th>
              <th>Solicitado</th>
              <th>Surtido</th>
              <th>Pendiente</th>
              <th>Progreso</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ items }) => items.map((tv) => {
              const idx = tv._idx
              const esSinLimite = !!tv.sinLimite
              const surtida = esSinLimite ? (tv.cantidadSurtida || 0) : Math.min(tv.cantidad, tv.cantidadSurtida || 0)
              const pendienteTv = esSinLimite ? null : Math.max(0, tv.cantidad - surtida)
              const pctTv = esSinLimite ? null : (tv.cantidad > 0 ? Math.round((surtida / tv.cantidad) * 100) : 0)
              const completo = !esSinLimite && surtida >= tv.cantidad
              const enProgreso = surtida > 0 && !completo
              const claseFila = completo ? 'fila-surtido-completo' : enProgreso ? 'fila-surtido-parcial' : 'fila-surtido-pendiente'
              const descTv = `${tv.marca} ${tv.pulgadas}"${tv.condicion ? ' ' + tv.condicion : ''}${tv.modelo ? ' ' + tv.modelo : ''}`
              const unidadTxt = unidadLabel(tv.cantidad || 1, tv.unidad)

              return (
                <tr key={idx} className={claseFila}>
                  <td data-label="SKU/LPN"><span className="sku-celda">{tv.modelo || '—'}</span></td>
                  <td data-label="Marca">{tv.marca}</td>
                  <td data-label="Modelo">{tv.modelo || '—'}</td>
                  <td data-label="Pulgadas">{tv.pulgadas}&quot;</td>
                  <td data-label="Condición">{tv.condicion ? <span className={`tag tag-${tv.condicion.toLowerCase()}`}>{tv.condicion}</span> : '—'}</td>
                  <td data-label="Solicitado">{esSinLimite ? 'Sin límite' : tv.cantidad}</td>
                  <td data-label="Surtido">{surtida}</td>
                  <td data-label="Pendiente">{pendienteTv === null ? '—' : pendienteTv}</td>
                  <td data-label="Progreso">
                    {pctTv === null ? '—' : (
                      <div className="barra-progreso-celda">
                        <div className="barra-progreso-track">
                          <div className={`barra-progreso-fill ${pctTv >= 100 ? 'completa' : pctTv > 0 ? 'avanzando' : 'vacia'}`} style={{ width: `${pctTv}%` }} />
                        </div>
                        <span className="barra-progreso-texto">{pctTv}%</span>
                      </div>
                    )}
                  </td>
                  <td data-label="Acción">
                    <div className="controles-cantidad">
                      <button
                        type="button"
                        className="btn-mini-action"
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
                        aria-label="Cantidad surtida"
                        className="controles-cantidad-input"
                      />
                      <button
                        type="button"
                        className="btn-mini-action"
                        onClick={() => actualizar(idx, surtida + 1, { inmediato: true })}
                        disabled={completo}
                        aria-label={t('surtir.sumarUno')}
                        title={t('surtir.sumarUno')}
                      >
                        <IconPlus />
                      </button>
                      <button
                        type="button"
                        className="btn-mini-action btn-listo"
                        onClick={() => {
                          if (esSinLimite) return
                          if (confirm(`¿Marcar como surtidas las ${tv.cantidad - surtida} ${unidadTxt} restantes de ${descTv}?`)) {
                            actualizar(idx, tv.cantidad, { inmediato: true })
                          }
                        }}
                        disabled={completo || esSinLimite}
                        aria-label="Completar"
                        title="Completar: marca este artículo como 100% surtido"
                      >
                        <IconCheck />
                      </button>
                      <button
                        type="button"
                        className="btn-mini-action btn-reset btn-reset-separado"
                        onClick={() => {
                          if (confirm('¿Restablecer la cantidad surtida de este artículo a 0?')) {
                            actualizar(idx, 0, { inmediato: true })
                          }
                        }}
                        disabled={surtida === 0}
                        aria-label={t('surtir.reiniciar')}
                        title="Restablecer a 0"
                      >
                        <IconRefresh />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>

      <ComentariosPedido
        pedidoId={pedido.id}
        comentariosIniciales={pedido.comentarios || ''}
        actualizadoIso={pedido.comentariosActualizado}
        actualizadoPorNombre={pedido.comentariosActualizadoPorNombre}
      />

      <div className="barra-sticky-surtido">
        <div className="barra-sticky-izquierda">
          <span className="barra-sticky-titulo">Guardado automático activado</span>
          <span className="barra-sticky-hora">{ultimoGuardado ? `Último guardado: ${formatearHora(ultimoGuardado)}` : '—'}</span>
          <span className={`badge-autoguardado estado-${estadoGlobal}`}>
            {estadoGlobal === 'guardando' && 'Guardando…'}
            {estadoGlobal === 'guardado' && 'Guardado'}
            {estadoGlobal === 'error' && 'Error al guardar'}
            {estadoGlobal === 'sinconexion' && 'Sin conexión'}
          </span>
        </div>
        <div className="barra-sticky-derecha">
          <button type="button" className="btn btn-secondary" onClick={guardarProgresoManual}>
            Guardar progreso
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={finalizarSurtido}
            disabled={!puedeFinalizar || finalizando}
            title={puedeFinalizar ? 'Finalizar surtido' : motivoBloqueoFinalizar}
          >
            <IconCheck /> Finalizar surtido
          </button>
        </div>
      </div>
    </div>
  )
}

function formatearFechaLimiteCorta(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d))
}
