'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { unidadLabel } from '@/lib/catalogos'
import ComentariosPedido from '../../components/comentarios-pedido'
import {
  IconAlert,
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconRefresh,
} from '../../components/icons'

function agruparPorMarca(televisiones) {
  const grupos = {}
  televisiones.forEach((tv, _idx) => {
    if (!grupos[tv.marca]) grupos[tv.marca] = []
    grupos[tv.marca].push({ ...tv, _idx })
  })
  return Object.keys(grupos).sort().map((marca) => ({
    marca,
    items: grupos[marca].sort((a, b) => a.pulgadas - b.pulgadas),
  }))
}

export default function SurtirCliente({ pedido }) {
  const [tvs, setTvs] = useState(pedido.televisiones)
  const [error, setError] = useState('')
  // Estado del autoguardado: 'idle' | 'guardando' | 'guardado' | 'error'
  const [estadoGuardado, setEstadoGuardado] = useState('idle')
  // Última acción para deshacer: { idx, valorAnterior, label } | null
  const [ultimaAccion, setUltimaAccion] = useState(null)
  const guardadoTimeout = useRef(null)
  const undoTimeout = useRef(null)
  const enVuelo = useRef(0)

  useEffect(() => {
    return () => {
      if (guardadoTimeout.current) clearTimeout(guardadoTimeout.current)
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
    }
  }, [])

  const grupos = useMemo(() => agruparPorMarca(tvs), [tvs])

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
  const completado = totalRequerido > 0 && totalSurtido >= totalRequerido

  const registrarUndo = (accion) => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    setUltimaAccion(accion)
    undoTimeout.current = setTimeout(() => setUltimaAccion(null), 6000)
  }

  const deshacer = () => {
    if (!ultimaAccion) return
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    const accion = ultimaAccion
    setUltimaAccion(null)
    actualizar(accion.idx, accion.valorAnterior, { esUndo: true })
  }

  const actualizar = async (idx, valorBruto, opciones = {}) => {
    const tv = tvs[idx]
    const limiteTv = tv.sinLimite ? Infinity : tv.cantidad
    const valor = Math.max(0, Math.min(limiteTv, Number(valorBruto) || 0))
    const valorAnterior = tv.cantidadSurtida || 0

    if (valor === valorAnterior) return

    setTvs((prev) => prev.map((t, i) => (i === idx ? { ...t, cantidadSurtida: valor } : t)))

    if (!opciones.esUndo) {
      const delta = valor - valorAnterior
      const signo = delta > 0 ? '+' : ''
      const desc = opciones.descripcion || `TV ${idx + 1}`
      registrarUndo({
        idx,
        valorAnterior,
        label: `${signo}${delta} en ${desc} (ahora ${valor}/${tv.cantidad})`,
      })
    }

    enVuelo.current += 1
    setEstadoGuardado('guardando')
    if (guardadoTimeout.current) clearTimeout(guardadoTimeout.current)

    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tvIndex: idx, cantidadSurtida: valor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo guardar')
      }
      setError('')
      enVuelo.current -= 1
      if (enVuelo.current === 0) {
        setEstadoGuardado('guardado')
        guardadoTimeout.current = setTimeout(() => setEstadoGuardado('idle'), 2200)
      }
    } catch (err) {
      enVuelo.current -= 1
      // Rollback al valor original guardado en el servidor
      setTvs((prev) =>
        prev.map((t, i) =>
          i === idx
            ? { ...t, cantidadSurtida: pedido.televisiones[idx].cantidadSurtida }
            : t
        )
      )
      setError(err.message)
      setEstadoGuardado('error')
    }
  }

  return (
    <main className="surtir">
      <header className="surtir-header">
        <div className="surtir-nav">
          <Link href="/surtir" className="btn btn-secondary btn-sm">
            <IconArrowLeft />
            Volver
          </Link>
          <Link href={`/pedidos/${pedido.id}/imprimir`} className="btn btn-secondary btn-sm">
            <IconPrinter />
            Imprimir
          </Link>
          {estadoGuardado !== 'idle' && (
            <span className={`save-status save-status-${estadoGuardado}`}>
              {estadoGuardado === 'guardando' && (
                <>
                  <span className="save-dot" />
                  Guardando…
                </>
              )}
              {estadoGuardado === 'guardado' && (
                <>
                  <IconCheck width={14} height={14} />
                  Guardado
                </>
              )}
              {estadoGuardado === 'error' && (
                <>
                  <IconAlert width={14} height={14} />
                  Error al guardar
                </>
              )}
            </span>
          )}
        </div>

        <h1 className="surtir-titulo">
          {pedido.numeroPedido ? `#${pedido.numeroPedido} — ` : ''}{pedido.pedidoNombre}
        </h1>

        {pedido.condiciones.length > 0 && (
          <div className="tags-celda surtir-tags">
            {pedido.condiciones.map((c) => (
              <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
            ))}
          </div>
        )}

        <div className={`progreso-resumen ${completado ? 'completado' : ''}`}>
          <div className="progreso-info">
            <span className="progreso-numero">
              {totalSurtido} <span className="progreso-de">de</span> {totalRequerido} surtidas
            </span>
            <span className="progreso-pct">{progreso}%</span>
          </div>
          <div className="progreso-track">
            <div className="progreso-fill" style={{ width: `${progreso}%` }} />
          </div>
          {completado && (
            <div className="progreso-completado">
              <IconCheck /> Pedido completo
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}

      <ComentariosPedido
        pedidoId={pedido.id}
        comentariosIniciales={pedido.comentarios || ''}
        actualizadoIso={pedido.comentariosActualizado}
        actualizadoPorNombre={pedido.comentariosActualizadoPorNombre}
      />

      <div className="surtir-lista">
        {grupos.map(({ marca, items }) => (
          <section key={marca} className="surtir-marca">
            <h2 className="surtir-marca-titulo">{marca.toUpperCase()}</h2>

            {items.map((tv) => {
              const idx = tv._idx
              const esSinLimite = !!tv.sinLimite
              const surtida = esSinLimite
                ? (tv.cantidadSurtida || 0)
                : Math.min(tv.cantidad, tv.cantidadSurtida || 0)
              const completo = !esSinLimite && surtida >= tv.cantidad
              const enProgreso = surtida > 0 && !completo
              const estado = completo ? 'completo' : enProgreso ? 'parcial' : 'pendiente'
              const esPallet = tv.unidad === 'pallet'
              const descTv = `${marca} ${tv.pulgadas}"${tv.modelo ? ' ' + tv.modelo : ''}`
              const unidadTxt = unidadLabel(tv.cantidad || 1, tv.unidad)

              const marcarTodas = () => {
                if (esSinLimite) return
                const restantes = tv.cantidad - surtida
                const ok = window.confirm(
                  `¿Marcar como surtidas las ${restantes} ${unidadTxt} restantes de ${descTv}?\n\nQuedará en ${tv.cantidad}/${tv.cantidad}.`
                )
                if (ok) actualizar(idx, tv.cantidad, { descripcion: descTv })
              }

              const reiniciar = () => {
                const ok = window.confirm(
                  `¿Reiniciar el conteo de ${descTv}?\n\nSe borrarán las ${surtida} ${unidadTxt} ya marcadas.`
                )
                if (ok) actualizar(idx, 0, { descripcion: descTv })
              }

              return (
                <div key={idx} className={`surtir-item estado-${estado}`}>
                  <div className="surtir-item-info">
                    <div className="surtir-item-titulo">
                      <span className="surtir-pulgadas">{tv.pulgadas}"</span>
                      {esPallet && (
                        <span className="surtir-pallet-tag">
                          <IconBox /> Pallet
                        </span>
                      )}
                      {tv.modelo && <span className="surtir-modelo">{tv.modelo}</span>}
                    </div>
                    <div className="surtir-item-cantidad">
                      {esSinLimite ? (
                        <strong>Sin límite</strong>
                      ) : (
                        <>
                          <strong>{tv.cantidad}</strong> {unidadLabel(tv.cantidad, tv.unidad)}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="surtir-item-controles">
                    <div className="surtir-counter">
                      <input
                        type="number"
                        min="0"
                        max={esSinLimite ? undefined : tv.cantidad}
                        value={surtida}
                        onChange={(e) => actualizar(idx, e.target.value, { descripcion: descTv })}
                        aria-label="Cantidad surtida"
                      />
                      <span className="surtir-counter-total">
                        {esSinLimite ? '/ ∞' : `/ ${tv.cantidad}`}
                      </span>
                    </div>

                    <div className="surtir-acciones">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm(
                            `¿Restar 1 ${unidadTxt} de ${descTv}?\n\nQuedará en ${surtida - 1}/${tv.cantidad}.`
                          )
                          if (ok) actualizar(idx, surtida - 1, { descripcion: descTv })
                        }}
                        disabled={surtida === 0}
                        className="btn-mini-action"
                        aria-label="Restar uno"
                        title="Restar uno"
                      >
                        <IconMinus />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm(
                            `¿Agregar 1 ${unidadTxt} a ${descTv}?\n\nQuedará en ${surtida + 1}/${tv.cantidad}.`
                          )
                          if (ok) actualizar(idx, surtida + 1, { descripcion: descTv })
                        }}
                        disabled={completo}
                        className="btn-mini-action"
                        aria-label="Sumar uno"
                        title="Sumar uno"
                      >
                        <IconPlus />
                      </button>
                      <button
                        type="button"
                        onClick={marcarTodas}
                        disabled={completo || esSinLimite}
                        className="btn-mini-action btn-listo"
                        aria-label="Marcar todas"
                        title={esSinLimite ? 'No aplica (sin límite)' : 'Marcar todas'}
                      >
                        <IconCheck />
                      </button>
                      <button
                        type="button"
                        onClick={reiniciar}
                        disabled={surtida === 0}
                        className="btn-mini-action btn-reset"
                        aria-label="Reiniciar"
                        title="Reiniciar a 0"
                      >
                        <IconRefresh />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </div>

      {ultimaAccion && (
        <div className="undo-toast" role="status">
          <div className="undo-toast-mensaje">
            <IconCheck width={16} height={16} />
            <span>{ultimaAccion.label}</span>
          </div>
          <button type="button" onClick={deshacer} className="undo-toast-btn">
            Deshacer
          </button>
        </div>
      )}
    </main>
  )
}
